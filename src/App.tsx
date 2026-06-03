import {
  ArrowLeft,
  AtSign,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Lock,
  Menu,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { parseEther, type Address } from "viem";
import { getBlackBoxConditionAddress } from "./lib/blackboxAccess";
import {
  buyPaidAccess,
  connectWallet,
  ensureCdrWasm,
  openOwnerOnlySecret,
  openPaidSecret,
  sealOwnerOnlySecret,
  sealPaidSecret,
} from "./lib/cdr";
import {
  fetchBackendListings,
  loadListings,
  mergeListings,
  saveBackendListing,
  saveUserListing,
  updateBackendListing,
  updateUserListing,
  type OracleListing,
} from "./lib/oracles";

type OperationStatus = "idle" | "loading" | "success" | "error";
type AppView = "market" | "email" | "dashboard";

const emptyForm = {
  title: "",
  category: "Private Insight",
  priceLabel: "0.10 IP",
  publicTease: "",
  weirdness: "",
  secret: "",
};

const demoForm = {
  title: "Backchannel Deal Signal",
  category: "Private Research",
  priceLabel: "0.08 IP",
  publicTease:
    "A sealed diligence note for one startup deal. Buyers unlock the verdict, not the source notes.",
  weirdness: "Turns private research into a paid answer while the evidence stays sealed.",
  secret:
    "Verdict: promising but fragile. The team ships quickly, but the customer pipeline depends on two warm intros that have not converted yet.",
};

function priceLabelToWei(priceLabel: string) {
  const match = priceLabel.trim().match(/^(\d+(?:\.\d{1,18})?)\s*IP$/i);
  if (!match) {
    throw new Error("Use a numeric paid price like 0.08 IP.");
  }

  const priceWei = parseEther(match[1]);
  if (priceWei <= 0n) {
    throw new Error("Paid drops need a price above 0 IP.");
  }

  return priceWei;
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

function storyScanTx(txHash?: string) {
  return txHash ? `https://aeneid.storyscan.io/tx/${txHash}` : undefined;
}

function storyScanAddress(address?: string) {
  return address ? `https://aeneid.storyscan.io/address/${address}` : undefined;
}

function App() {
  const [view, setView] = useState<AppView>("market");
  const [introOpen, setIntroOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const [account, setAccount] = useState<Address>();
  const [listings, setListings] = useState<OracleListing[]>(() => loadListings());
  const [selectedId, setSelectedId] = useState("seed-1");
  const [status, setStatus] = useState<OperationStatus>("idle");
  const [message, setMessage] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [readTx, setReadTx] = useState("");
  const [recoveryUuid, setRecoveryUuid] = useState("");
  const [form, setForm] = useState(emptyForm);

  const selected = useMemo(
    () => listings.find((listing) => listing.id === selectedId) ?? listings[0],
    [listings, selectedId],
  );
  const liveListings = useMemo(() => listings.filter((listing) => listing.vaultUuid), [listings]);
  const conditionContract = getBlackBoxConditionAddress();

  useEffect(() => {
    let mounted = true;
    ensureCdrWasm()
      .then(() => undefined)
      .catch((error) => mounted && setMessage(error instanceof Error ? error.message : "CDR WASM failed to load."));

    void refreshListings({ silent: true });

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshListings(options: { silent?: boolean } = {}) {
    try {
      const remoteListings = await fetchBackendListings();
      setListings(mergeListings([...remoteListings, ...loadListings()]));
      if (!options.silent) {
        setStatus("success");
        setMessage("Listings refreshed from the BlackBox database.");
      }
    } catch (error) {
      if (!options.silent) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not refresh backend listings.");
      }
    }
  }

  async function onConnect() {
    setStatus("loading");
    setMessage("Waiting for wallet approval...");
    try {
      const nextAccount = await connectWallet();
      setAccount(nextAccount);
      setStatus("success");
      setMessage("Wallet connected to Story Aeneid.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not connect wallet.");
    }
  }

  function openDashboard() {
    setIntroOpen(false);
    setSidebarOpen(false);
    if (!connectedEmail) {
      setView("email");
      window.setTimeout(() => document.getElementById("email-connect")?.scrollIntoView({ behavior: "smooth" }), 0);
      return;
    }
    setView("dashboard");
    window.setTimeout(() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function openMarket() {
    setView("market");
    setSidebarOpen(false);
  }

  function openLiveVault() {
    setIntroOpen(true);
    setSidebarOpen(false);
  }

  function onEmailConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email to launch the dashboard.");
      return;
    }

    const normalizedEmail = trimmed.toLowerCase();
    void fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    }).catch(() => undefined);

    setConnectedEmail(normalizedEmail);
    setView("dashboard");
    setStatus("success");
    setMessage(`Dashboard opened for ${normalizedEmail}. Connect your wallet to seal and recover insight drops.`);
    window.setTimeout(() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function useDemoTemplate() {
    setForm(demoForm);
    setMessage("Example drop loaded. Review the sealed answer, then create the CDR vault.");
    setStatus("success");
  }

  async function onSeal() {
    if (!account) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }

    if (!form.title.trim() || !form.publicTease.trim() || !form.secret.trim()) {
      setMessage("Give the drop a title, public tease, and sealed answer.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage(
      conditionContract
        ? "Creating a paid-access CDR vault, confirming the price gate, then encrypting locally..."
        : "Allocating a CDR vault, encrypting locally, then writing on-chain...",
    );
    try {
      const priceWei = conditionContract ? priceLabelToWei(form.priceLabel) : undefined;
      const result = conditionContract
        ? await sealPaidSecret({
            account,
            secret: form.secret,
            priceWei: priceWei!,
            conditionContract,
          })
        : await sealOwnerOnlySecret({
            account,
            secret: form.secret,
          });
      const configureTx = "configureTx" in result ? (result.configureTx as OracleListing["configureTx"]) : undefined;
      const listing: OracleListing = {
        id: crypto.randomUUID(),
        title: form.title,
        category: form.category,
        publicTease: form.publicTease,
        priceLabel: form.priceLabel,
        weirdness: form.weirdness || "A sealed answer that exists before anyone can see it.",
        owner: account,
        vaultUuid: result.uuid,
        allocateTx: result.allocateTx,
        writeTx: result.writeTx,
        configureTx,
        conditionContract,
        priceWei: priceWei?.toString(),
        accessMode: conditionContract ? "paid" : "owner-only",
        createdAt: new Date().toISOString(),
      };
      saveUserListing(listing);
      setListings((current) => [listing, ...current]);
      void saveBackendListing(listing)
        .then((saved) => {
          if (saved) setListings((current) => mergeListings([saved, ...current]));
        })
        .catch(() => undefined);
      setSelectedId(listing.id);
      setRecoveryUuid(String(result.uuid));
      setForm(emptyForm);
      setStatus("success");
      setMessage(
        conditionContract
          ? `Paid insight drop sealed in CDR vault #${result.uuid}. Request decryption is ready.`
          : `Insight drop sealed in CDR vault #${result.uuid}. Request decryption is ready.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not seal this drop.");
    }
  }

  async function onReveal() {
    if (!selected?.vaultUuid) {
      setIntroOpen(true);
      return;
    }

    if (!account) {
      setStatus("error");
      setMessage("Connect the wallet allowed to read this vault.");
      return;
    }

    setStatus("loading");
    setRevealedSecret("");
    setReadTx("");
    setMessage("Requesting CDR decryption. Validators can take up to two minutes to respond.");
    try {
      const result =
        selected.accessMode === "paid"
          ? await openPaidSecret({
              account,
              uuid: selected.vaultUuid,
            })
          : await openOwnerOnlySecret({
              account,
              uuid: selected.vaultUuid,
            });
      setRevealedSecret(result.secret);
      setReadTx(result.readTx);
      setStatus("success");
      setMessage("Secret recovered from CDR.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not read this vault.");
    }
  }

  async function onRecoverVault() {
    const uuid = Number(recoveryUuid);
    if (!Number.isInteger(uuid) || uuid <= 0) {
      setStatus("error");
      setMessage("Enter a valid CDR vault UUID.");
      return;
    }

    if (!account) {
      setStatus("error");
      setMessage("Connect the wallet allowed to recover this vault.");
      return;
    }

    setStatus("loading");
    setRevealedSecret("");
    setReadTx("");
    setMessage(`Requesting CDR recovery for vault #${uuid}...`);
    try {
      const result = await openPaidSecret({ account, uuid });
      setRevealedSecret(result.secret);
      setReadTx(result.readTx);
      setStatus("success");
      setMessage(`Vault #${uuid} recovered.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not recover this vault.");
    }
  }

  async function onBuyAccess() {
    if (!selected?.vaultUuid || !selected.conditionContract || !selected.owner) {
      setStatus("error");
      setMessage("This drop does not have a paid access contract configured.");
      return;
    }

    if (!account) {
      setStatus("error");
      setMessage("Connect the buyer wallet first.");
      return;
    }

    setStatus("loading");
    setMessage("Confirm the buyer payment, then wait for the access gate transaction to mine...");
    try {
      const result = await buyPaidAccess({
        account,
        uuid: selected.vaultUuid,
        owner: selected.owner,
        conditionContract: selected.conditionContract,
      });
      const updatedListing: OracleListing = { ...selected, buyTx: result.txHash, priceWei: result.priceWei.toString() };
      updateUserListing(updatedListing);
      setListings((current) => current.map((listing) => (listing.id === selected.id ? updatedListing : listing)));
      void updateBackendListing(updatedListing)
        .then((saved) => {
          if (saved) setListings((current) => current.map((listing) => (listing.id === saved.id ? saved : listing)));
        })
        .catch(() => undefined);
      setStatus("success");
      setMessage("Access purchased. You can now request CDR decryption with this buyer wallet.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not buy access.");
    }
  }

  function copySelected() {
    if (!selected) return;
    const payload = JSON.stringify(selected, null, 2);
    void navigator.clipboard.writeText(payload);
    setMessage("Drop metadata copied.");
  }

  return (
    <main className="app-shell">
      {sidebarOpen ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

      <aside className={`desktop-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar-top">
          <button className="sidebar-brand" onClick={openMarket}>
            <span className="brand-mark">
              <Lock size={18} />
            </span>
            <span>
              <strong>BlackBox</strong>
              <small>Oracle</small>
            </span>
          </button>
          <button className="sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <SidebarButton
            active={view === "market"}
            icon={<ListFilter size={18} />}
            label="Market"
            note="Browse sealed drops"
            onClick={openMarket}
          />
          <SidebarButton
            active={view === "email" || view === "dashboard"}
            icon={<LayoutDashboard size={18} />}
            label={connectedEmail ? "Dashboard" : "Launch App"}
            note={connectedEmail ? "Create and recover drops" : "Connect email first"}
            onClick={openDashboard}
          />
          <SidebarButton
            active={introOpen}
            icon={<Sparkles size={18} />}
            label="Live Vault"
            note="Start the demo flow"
            onClick={openLiveVault}
          />
        </nav>

        <div className="sidebar-status">
          <p className="eyebrow">session</p>
          <InfoTile label="Email" value={connectedEmail || "not connected"} />
          <InfoTile label="Wallet" value={account ? shortHash(account) : "not connected"} />
          <InfoTile label="Network" value="Story Aeneid" />
        </div>

        <button className="sidebar-wallet" onClick={onConnect}>
          <Wallet size={18} />
          {account ? "Switch Wallet" : "Connect Wallet"}
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={19} />
          </button>
          <button className="brand-lockup" onClick={openMarket}>
            <span className="brand-mark">
              <Lock size={18} />
            </span>
            <span>BlackBox Oracle</span>
          </button>
          <div className="topbar-actions">
            <button className="ghost-action" onClick={openMarket}>
              <ListFilter size={17} />
              Market
            </button>
            <button className="ghost-action" onClick={openDashboard}>
              <LayoutDashboard size={17} />
              {connectedEmail ? "Dashboard" : "Launch App"}
            </button>
            <button className="wallet-button" onClick={onConnect}>
              <Wallet size={18} />
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect"}
            </button>
          </div>
        </header>

        {view === "market" ? (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">for private researchers, tipsters, and creators</p>
                <h1>Sell one secret answer without exposing the source.</h1>
                <p>
                  BlackBox Oracle is a marketplace for sealed insight drops. A creator locks a sensitive answer in CDR,
                  a buyer unlocks only that answer, and the notes, files, or backstory never leave the vault.
                </p>
                <div className="hero-actions">
                  <button className="secondary-action fit-action" onClick={() => setView("email")}>
                    <LayoutDashboard size={18} />
                    Create A Drop
                  </button>
                  <button className="primary-action fit-action" onClick={() => setIntroOpen(true)}>
                    <Sparkles size={18} />
                    Try Live Vault
                  </button>
                </div>
              </div>
              <div className="hero-orbit" aria-hidden="true">
                <AnimatedBlackBox compact />
                <div className="orbit-chip chip-a">tip sealed</div>
                <div className="orbit-chip chip-b">buyer unlocks</div>
                <div className="orbit-chip chip-c">source hidden</div>
              </div>
            </section>

            <section className="target-strip" aria-label="Who BlackBox Oracle is for">
              <AudienceCard title="Creators" text="Package private notes as one paid answer instead of handing over the whole file." />
              <AudienceCard title="Buyers" text="Pay for the useful verdict, signal, or tip without receiving extra sensitive context." />
              <AudienceCard title="Sources" text="Keep raw evidence, names, screenshots, and research material encrypted in CDR." />
            </section>

            <div className="main-grid market-grid">
              <MarketPanel
                listings={listings}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                refresh={refreshListings}
                clearReveal={() => {
                  setRevealedSecret("");
                  setReadTx("");
                }}
              />
              <OraclePanel
                account={account}
                selected={selected}
                revealedSecret={revealedSecret}
                readTx={readTx}
                copySelected={copySelected}
                onBuyAccess={onBuyAccess}
                onReveal={onReveal}
              />
            </div>
          </>
        ) : view === "email" ? (
          <section className="email-page" id="email-connect">
            <div className="email-card">
              <AnimatedBlackBox compact />
              <div className="email-copy">
                <p className="eyebrow">launch app</p>
                <h1>Open your private insight dashboard.</h1>
                <p>
                  Email labels your demo session. Wallet approvals still happen through Story Aeneid, and sealed answers
                  still reveal only through CDR.
                </p>
              </div>
              <form className="email-form" onSubmit={onEmailConnect}>
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <button className="primary-action" type="submit">
                  <AtSign size={18} />
                  Enter Dashboard
                </button>
              </form>
            </div>
          </section>
        ) : (
          <section className="dashboard-page" id="dashboard">
            <div className="dashboard-head">
              <button className="ghost-action" onClick={() => setView("market")}>
                <ArrowLeft size={17} />
                Market
              </button>
              <div>
                <p className="eyebrow">creator dashboard</p>
                <h1>Create A Sealed Insight</h1>
              </div>
              <button className="secondary-action fit-action" onClick={useDemoTemplate}>
                <Wand2 size={18} />
                Use Example
              </button>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">new drop</p>
                    <h3>Private Insight Listing</h3>
                  </div>
                  <Lock size={22} />
                </div>
                <p className="tease">
                  Write the public tease buyers can inspect, then seal the private answer into a CDR vault.
                </p>
                <VaultForm form={form} setForm={setForm} />
                <button className="primary-action" onClick={onSeal}>
                  {status === "loading" ? <Loader2 className="spin" size={18} /> : <Lock size={18} />}
                  Create CDR Vault
                </button>
              </section>

              <div className="dashboard-side">
                <AccountPanel
                  account={account}
                  connectedEmail={connectedEmail}
                  selected={selected}
                  onConnect={onConnect}
                />

                <section className="panel recovery-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">CDR reveal</p>
                      <h3>Recover A Sealed Answer</h3>
                    </div>
                    <RotateCcw size={22} />
                  </div>
                  <p className="tease">
                    Enter a vault UUID or use the selected drop, then request decryption with an approved wallet.
                  </p>
                  <label>
                    Vault UUID
                    <input
                      value={recoveryUuid}
                      onChange={(event) => setRecoveryUuid(event.target.value)}
                      placeholder={selected?.vaultUuid ? String(selected.vaultUuid) : "Example: 12345"}
                    />
                  </label>
                  <button className="secondary-action" onClick={onRecoverVault}>
                    <Eye size={18} />
                    Request Decryption
                  </button>
                  {selected?.vaultUuid ? (
                    <button className="primary-action" onClick={onReveal}>
                      <Eye size={18} />
                      Decrypt Selected Vault #{selected.vaultUuid}
                    </button>
                  ) : null}
                  {revealedSecret ? (
                    <div className="reveal">
                      <p className="eyebrow">recovered answer</p>
                      <strong>{revealedSecret}</strong>
                      {readTx ? <small>Read tx: {readTx}</small> : null}
                    </div>
                  ) : null}
                </section>

                <section className="panel live-vaults-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">live vaults</p>
                      <h3>Recent Drops</h3>
                    </div>
                    <Sparkles size={22} />
                  </div>
                  <div className="live-vault-list">
                    {liveListings.length ? (
                      liveListings.map((listing) => (
                        <button
                          className={`live-vault-row ${selectedId === listing.id ? "active" : ""}`}
                          key={listing.id}
                          onClick={() => {
                            setSelectedId(listing.id);
                            setRecoveryUuid(String(listing.vaultUuid ?? ""));
                            setRevealedSecret("");
                            setReadTx("");
                          }}
                        >
                          <strong>{listing.title}</strong>
                          <span>Vault #{listing.vaultUuid}</span>
                        </button>
                      ))
                    ) : (
                      <p className="empty-copy">Create your first sealed insight and it will appear here.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </section>
        )}

        <section className={`status-console ${status}`}>
          {status === "success" ? <CheckCircle2 size={18} /> : <MessageSquareQuote size={18} />}
          <span>{message || "Ready. Connect a funded Aeneid wallet when you want to seal a private insight."}</span>
        </section>

        <nav className="mobile-dock" aria-label="Mobile sections">
          <button onClick={() => setView("market")}>
            <ListFilter size={18} />
            <span>Market</span>
          </button>
          <button onClick={openDashboard}>
            <LayoutDashboard size={18} />
            <span>{connectedEmail ? "Dash" : "Launch"}</span>
          </button>
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
            <span>Menu</span>
          </button>
        </nav>
      </section>

      {introOpen ? (
        <div className="intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <section className="intro-modal">
            <AnimatedBlackBox compact />
            <div>
              <p className="eyebrow">live vault mode</p>
              <h2 id="intro-title">Seal one private answer, then prove it can be recovered.</h2>
              <p>
                First enter an email to launch the dashboard. Then connect a wallet, create a CDR vault, and request
                decryption with the approved wallet.
              </p>
            </div>
            <div className="intro-actions">
              <button className="secondary-action" onClick={() => setIntroOpen(false)}>
                Stay Here
              </button>
              <button className="primary-action" onClick={openDashboard}>
                <LayoutDashboard size={18} />
                Open Dashboard
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function AccountPanel(props: {
  account?: Address;
  connectedEmail: string;
  selected?: OracleListing;
  onConnect: () => void;
}) {
  const selected = props.selected;

  return (
    <section className="panel account-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">session</p>
          <h3>Creator Wallet</h3>
        </div>
        <Wallet size={22} />
      </div>
      <div className="account-grid">
        <InfoTile label="Email" value={props.connectedEmail || "not connected"} />
        <InfoTile label="Wallet" value={props.account ? shortHash(props.account) : "not connected"} />
        <InfoTile label="Selected drop" value={selected?.title ?? "none selected"} />
        <InfoTile label="Unlock price" value={selected?.priceLabel ?? "select a drop"} />
      </div>
      <div className="account-tease">
        <p className="eyebrow">selected tease</p>
        <strong>{selected?.publicTease ?? "Select or create a sealed drop to see its public tease."}</strong>
      </div>
      <button className="secondary-action" onClick={props.onConnect}>
        <Wallet size={18} />
        {props.account ? "Switch Wallet" : "Connect Wallet"}
      </button>
    </section>
  );
}

function MarketPanel(props: {
  listings: OracleListing[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  refresh: () => void;
  clearReveal: () => void;
}) {
  return (
    <section className="panel market-panel" id="market">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">market</p>
          <h3>Sealed Insight Drops</h3>
        </div>
        <button className="icon-button" onClick={props.refresh} title="Refresh listings">
          <RefreshCw size={18} />
        </button>
      </div>
      <p className="panel-note">Choose a public tease, then unlock only the answer the creator agreed to reveal.</p>

      <div className="oracle-list">
        {props.listings.map((listing) => (
          <button
            className={`oracle-row ${props.selectedId === listing.id ? "active" : ""}`}
            key={listing.id}
            onClick={() => {
              props.setSelectedId(listing.id);
              props.clearReveal();
            }}
          >
            <span className="row-icon">{listing.vaultUuid ? <Lock size={18} /> : <BrainCircuit size={18} />}</span>
            <span>
              <strong>{listing.title}</strong>
              <small>{listing.category}</small>
            </span>
            <em>{listing.priceLabel}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function OraclePanel(props: {
  account?: Address;
  selected?: OracleListing;
  revealedSecret: string;
  readTx: string;
  copySelected: () => void;
  onBuyAccess: () => void;
  onReveal: () => void;
}) {
  const selected = props.selected;
  if (!selected) return null;

  return (
    <section className="panel focus-panel" id="oracle">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{selected.category}</p>
          <h3>{selected.title}</h3>
        </div>
        <button className="icon-button" onClick={props.copySelected} title="Copy drop metadata">
          <Copy size={18} />
        </button>
      </div>
      <p className="tease">{selected.publicTease}</p>
      <div className="promise-grid">
        <div className="promise-card">
          <small>Buyer gets</small>
          <strong>One approved answer from the sealed vault.</strong>
        </div>
        <div className="promise-card">
          <small>Source keeps</small>
          <strong>Raw notes, files, and context hidden in CDR.</strong>
        </div>
      </div>
      <div className="detail-grid">
        <InfoTile label="Unlock" value={selected.priceLabel} />
        <InfoTile label="Vault" value={selected.vaultUuid ? `#${selected.vaultUuid}` : "not sealed yet"} />
        <InfoTile label="Mode" value={selected.accessMode === "paid" ? "paid access" : "owner proof"} />
      </div>
      {selected.vaultUuid || selected.conditionContract || selected.owner ? (
        <ProofLinks selected={selected} />
      ) : null}
      <div className="weird-box">
        <Sparkles size={18} />
        <span>{selected.weirdness}</span>
      </div>
      {selected.accessMode === "paid" && props.account !== selected.owner ? (
        <button className="secondary-action" onClick={props.onBuyAccess}>
          <CircleDollarSign size={18} />
          Buy Access
        </button>
      ) : null}
      <button className="primary-action" onClick={props.onReveal}>
        <Eye size={18} />
        {selected.vaultUuid ? "Unlock Sealed Answer" : "Try Live Vault"}
      </button>
      {props.revealedSecret ? (
        <div className="reveal">
          <p className="eyebrow">sealed answer</p>
          <strong>{props.revealedSecret}</strong>
          {selected.buyTx ? <small>Buy tx: {selected.buyTx}</small> : null}
          {props.readTx ? <small>Read tx: {props.readTx}</small> : null}
        </div>
      ) : null}
    </section>
  );
}

function VaultForm(props: {
  form: typeof emptyForm;
  setForm: (form: typeof emptyForm) => void;
}) {
  const { form, setForm } = props;
  return (
    <div className="form-grid">
      <label>
        Drop title
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Backchannel Deal Signal"
        />
      </label>
      <label>
        Insight type
        <input
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder="Private Research"
        />
      </label>
      <label>
        Unlock price
        <input
          value={form.priceLabel}
          onChange={(event) => setForm({ ...form, priceLabel: event.target.value })}
          placeholder="0.10 IP"
        />
      </label>
      <label>
        Public tease
        <textarea
          value={form.publicTease}
          onChange={(event) => setForm({ ...form, publicTease: event.target.value })}
          placeholder="What buyers can know before they unlock."
          rows={3}
        />
      </label>
      <label>
        Sealed answer
        <textarea
          value={form.secret}
          onChange={(event) => setForm({ ...form, secret: event.target.value })}
          placeholder="This answer is encrypted into a CDR vault."
          rows={5}
        />
      </label>
      <label>
        Why it matters
        <textarea
          value={form.weirdness}
          onChange={(event) => setForm({ ...form, weirdness: event.target.value })}
          placeholder="Why this drop is worth unlocking."
          rows={2}
        />
      </label>
    </div>
  );
}

function AnimatedBlackBox(props: { compact?: boolean }) {
  return (
    <div className={`blackbox-scene ${props.compact ? "compact" : ""}`} aria-hidden="true">
      <div className="box-shadow" />
      <div className="box-body">
        <div className="box-lid" />
        <div className="box-face front">
          <Lock size={props.compact ? 34 : 44} />
          <span>CDR</span>
        </div>
        <div className="box-face side" />
        <div className="box-face top" />
        <div className="box-light" />
      </div>
    </div>
  );
}

function ProofLinks(props: { selected: OracleListing }) {
  const selected = props.selected;
  return (
    <div className="chain-links" aria-label="On-chain proof">
      {selected.owner ? <ExternalLinkItem label="Owner" value={shortHash(selected.owner)} href={storyScanAddress(selected.owner)} /> : null}
      {selected.conditionContract ? (
        <ExternalLinkItem label="Condition" value={shortHash(selected.conditionContract)} href={storyScanAddress(selected.conditionContract)} />
      ) : null}
      {selected.allocateTx ? <ExternalLinkItem label="Allocate" value={shortHash(selected.allocateTx)} href={storyScanTx(selected.allocateTx)} /> : null}
      {selected.writeTx ? <ExternalLinkItem label="Write" value={shortHash(selected.writeTx)} href={storyScanTx(selected.writeTx)} /> : null}
      {selected.configureTx ? <ExternalLinkItem label="Configure" value={shortHash(selected.configureTx)} href={storyScanTx(selected.configureTx)} /> : null}
      {selected.buyTx ? <ExternalLinkItem label="Buy" value={shortHash(selected.buyTx)} href={storyScanTx(selected.buyTx)} /> : null}
    </div>
  );
}

function InfoTile(props: { label: string; value: string }) {
  return (
    <div className="info-tile">
      <small>{props.label}</small>
      <strong>{props.value}</strong>
    </div>
  );
}

function ExternalLinkItem(props: { label: string; value: string; href?: string }) {
  if (!props.href) return null;

  return (
    <a className="chain-link" href={props.href} target="_blank" rel="noreferrer">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <ExternalLink size={14} />
    </a>
  );
}

function AudienceCard(props: { title: string; text: string }) {
  return (
    <div className="audience-card">
      <strong>{props.title}</strong>
      <p>{props.text}</p>
    </div>
  );
}

function SidebarButton(props: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button className={`sidebar-button ${props.active ? "active" : ""}`} onClick={props.onClick}>
      <span className="sidebar-button-icon">{props.icon}</span>
      <span>
        <strong>{props.label}</strong>
        <small>{props.note}</small>
      </span>
    </button>
  );
}

export default App;
