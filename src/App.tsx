import {
  ArrowLeft,
  AtSign,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Lock,
  Menu,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
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
  configurePaidListing,
  connectWallet,
  ensureCdrWasm,
  getCdrFees,
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
  category: "Private Data",
  priceLabel: "0.10 IP",
  publicTease: "",
  weirdness: "",
  secret: "",
};

const demoForm = {
  title: "The Anti-Resume Oracle",
  category: "Private Data",
  priceLabel: "0.08 IP",
  publicTease:
    "A private founder-evaluation rubric. Buyers pay for one verdict, but never see the underlying notes.",
  weirdness: "A hiring signal that sells the answer without leaking the private evaluation dataset.",
  secret:
    'This founder is a "shipper under pressure": inconsistent polish, unusually high recovery speed, and a strong bias toward prototypes over planning.',
};

function priceLabelToWei(priceLabel: string) {
  const match = priceLabel.match(/(\d+(?:\.\d+)?)/);
  return parseEther(match?.[1] ?? "0");
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
  const [emailCode, setEmailCode] = useState("");
  const [emailChallenge, setEmailChallenge] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const [account, setAccount] = useState<Address>();
  const [wasmReady, setWasmReady] = useState(false);
  const [fees, setFees] = useState<{ allocate: bigint; write: bigint; read: bigint }>();
  const [listings, setListings] = useState<OracleListing[]>(() => loadListings());
  const [selectedId, setSelectedId] = useState("seed-1");
  const [status, setStatus] = useState<OperationStatus>("idle");
  const [message, setMessage] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [readTx, setReadTx] = useState("");
  const [recoveryUuid, setRecoveryUuid] = useState("");
  const [question, setQuestion] = useState("What is the one answer I am allowed to know?");
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
      .then(() => mounted && setWasmReady(true))
      .catch((error) => mounted && setMessage(error instanceof Error ? error.message : "CDR WASM failed to load."));

    getCdrFees()
      .then((nextFees) => mounted && setFees(nextFees))
      .catch(() => {
        if (mounted) setFees(undefined);
      });

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

  async function onEmailConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email to launch the dashboard.");
      return;
    }

    setStatus("loading");
    setMessage("Sending your BlackBox launch code...");
    try {
      const response = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const result = (await response.json()) as {
        challenge?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.challenge) {
        throw new Error(result.error ?? "Could not send launch code.");
      }

      setEmailChallenge(result.challenge);
      setEmailCode("");
      setStatus("success");
      setMessage(result.message ?? `Launch code sent to ${trimmed}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not send launch code.");
    }
  }

  async function onVerifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailChallenge) {
      setStatus("error");
      setMessage("Request a launch code first.");
      return;
    }

    setStatus("loading");
    setMessage("Verifying launch code...");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: emailChallenge, code: emailCode }),
      });
      const result = (await response.json()) as { email?: string; error?: string };
      if (!response.ok || !result.email) {
        throw new Error(result.error ?? "Could not verify launch code.");
      }

      setConnectedEmail(result.email);
      setView("dashboard");
      setStatus("success");
      setMessage(`Email verified: ${result.email}. Connect your wallet to seal and recover CDR vaults.`);
      window.setTimeout(() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }), 0);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not verify launch code.");
    }
  }

  function useDemoTemplate() {
    setForm(demoForm);
    setMessage("Demo oracle loaded. Review the private answer, then create the CDR vault.");
    setStatus("success");
  }

  async function onSeal() {
    if (!account) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }

    if (!form.title.trim() || !form.publicTease.trim() || !form.secret.trim()) {
      setMessage("Give the oracle a title, public tease, and private secret.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage(
      conditionContract
        ? "Creating a paid-access CDR vault, encrypting locally, then waiting for the price gate to confirm..."
        : "Allocating a CDR vault, encrypting locally, then writing on-chain...",
    );
    try {
      const priceWei = priceLabelToWei(form.priceLabel);
      const result = conditionContract
        ? await sealPaidSecret({
            account,
            secret: form.secret,
            conditionContract,
          })
        : await sealOwnerOnlySecret({
            account,
            secret: form.secret,
          });
      const configureResult =
        conditionContract && result.uuid
          ? await configurePaidListing({
              account,
              uuid: result.uuid,
              priceWei,
              conditionContract,
            })
          : undefined;
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
        configureTx: configureResult?.txHash,
        conditionContract,
        priceWei: priceWei.toString(),
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
          ? `Paid oracle sealed in CDR vault #${result.uuid}. Request decryption is ready.`
          : `Oracle sealed in CDR vault #${result.uuid}. Request decryption is ready.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not seal oracle.");
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
    if (!selected?.vaultUuid || !selected.conditionContract || !selected.priceWei) {
      setStatus("error");
      setMessage("This oracle does not have a paid access contract configured.");
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
        priceWei: BigInt(selected.priceWei),
        conditionContract: selected.conditionContract,
      });
      const updatedListing: OracleListing = { ...selected, buyTx: result.txHash };
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
    setMessage("Oracle metadata copied.");
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
            note="Browse sealed answers"
            onClick={openMarket}
          />
          <SidebarButton
            active={view === "email" || view === "dashboard"}
            icon={<LayoutDashboard size={18} />}
            label={connectedEmail ? "Dashboard" : "Launch App"}
            note={connectedEmail ? "Seal and recover vaults" : "Connect email first"}
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
          <InfoTile label="Payment gate" value={conditionContract ? shortHash(conditionContract) : "owner proof"} />
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

        <section className="signal-strip" aria-label="Project status">
          <StatusPill icon={<ShieldCheck size={18} />} label={wasmReady ? "CDR WASM ready" : "Loading CDR"} />
          <StatusPill icon={<KeyRound size={18} />} label="Story Aeneid" />
          <StatusPill icon={<CircleDollarSign size={18} />} label={fees ? "Fees detected" : "Fee check pending"} />
          <StatusPill icon={<Lock size={18} />} label={conditionContract ? `Gate ${shortHash(conditionContract)}` : "Owner-only fallback"} />
        </section>

        {view === "market" ? (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">sealed answers / paid unlocks / private data rails</p>
                <h1>Sell the answer. Keep the dataset sealed.</h1>
                <p>
                  BlackBox Oracle turns private knowledge into a programmable market object. A creator seals the answer
                  in CDR, a buyer pays the access gate, and only an approved wallet can request decryption.
                </p>
                <div className="hero-actions">
                  <button className="primary-action fit-action" onClick={() => setIntroOpen(true)}>
                    <Sparkles size={18} />
                    Try Live Vault
                  </button>
                  <button className="secondary-action fit-action" onClick={() => setView("email")}>
                    <LayoutDashboard size={18} />
                    Launch App
                  </button>
                </div>
              </div>
              <div className="hero-orbit" aria-hidden="true">
                <AnimatedBlackBox compact />
                <div className="orbit-chip chip-a">encrypted</div>
                <div className="orbit-chip chip-b">paid gate</div>
                <div className="orbit-chip chip-c">recoverable</div>
              </div>
            </section>

            <section className="proof-strip" aria-label="Live demo proof">
              <ProofItem label="Contract" value="verified" />
              <ProofItem label="CDR API" value="HTTPS proxy live" />
              <ProofItem label="Network" value="Story Aeneid" />
              <ProofItem label="Flow" value="seal / buy / reveal" />
            </section>

            <section className="how-strip" aria-label="How BlackBox Oracle works">
              <HowStep index="01" title="Creator seals" text="Private answer is encrypted locally and written to a CDR vault." />
              <HowStep index="02" title="Buyer pays" text="The access contract records who paid for the vault UUID." />
              <HowStep index="03" title="CDR checks" text="Validators check the read condition before releasing partials." />
              <HowStep index="04" title="Secret reveals" text="Only the allowed wallet can recover the sealed answer." />
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
                question={question}
                setQuestion={setQuestion}
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
                <h1>Connect your email to enter the BlackBox dashboard.</h1>
                <p>
                  Email gives the demo a user identity layer. Wallet approvals still happen through Story Aeneid, and
                  private answers still reveal only through CDR.
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
                  Send Code
                </button>
              </form>
              {emailChallenge ? (
                <form className="code-form" onSubmit={onVerifyEmailCode}>
                  <label>
                    Launch code
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code"
                    />
                  </label>
                  <button className="primary-action" type="submit">
                    <KeyRound size={18} />
                    Verify Code
                  </button>
                  <p className="demo-code-note">Check your email inbox for the 6-digit launch code.</p>
                </form>
              ) : null}
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
                <h1>Seal A BlackBox</h1>
              </div>
              <button className="secondary-action fit-action" onClick={useDemoTemplate}>
                <Wand2 size={18} />
                Demo Template
              </button>
            </div>

            <div className="dashboard-grid">
              <AccountPanel
                account={account}
                connectedEmail={connectedEmail}
                selected={selected}
                conditionContract={conditionContract}
                onConnect={onConnect}
              />

              <section className="vault-stage" aria-label="Animated BlackBox vault">
                <AnimatedBlackBox />
                <div className="vault-stage-copy">
                  <p className="eyebrow">private data chamber</p>
                  <h2>Open the box, seal the answer, let the contract decide who reads it.</h2>
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">new vault</p>
                    <h3>Private Data Listing</h3>
                  </div>
                  <Lock size={22} />
                </div>
                <VaultForm form={form} setForm={setForm} />
                <button className="primary-action" onClick={onSeal}>
                  {status === "loading" ? <Loader2 className="spin" size={18} /> : <Lock size={18} />}
                  Create CDR Vault
                </button>
              </section>

              <section className="panel recovery-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CDR reveal</p>
                    <h3>Vault Recovery</h3>
                  </div>
                  <RotateCcw size={22} />
                </div>
                <p className="tease">
                  This is where the sealed vault opens. Enter a UUID or use the selected vault, then request CDR
                  decryption with an approved wallet.
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
                    <h3>Recent BlackBoxes</h3>
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
                    <p className="empty-copy">Create your first CDR vault and it will appear here with proof links.</p>
                  )}
                </div>
              </section>

              <section className="panel demo-script-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">recording guide</p>
                    <h3>Demo Script</h3>
                  </div>
                  <Sparkles size={22} />
                </div>
                <ol className="demo-script-list">
                  <li>Connect creator wallet and load the demo template.</li>
                  <li>Create a CDR vault and show the payment-gate details.</li>
                  <li>Switch to buyer wallet, buy access, then request decryption.</li>
                  <li>End on the recovered answer and StoryScan proof links.</li>
                </ol>
              </section>
            </div>
          </section>
        )}

        <section className={`status-console ${status}`}>
          {status === "success" ? <CheckCircle2 size={18} /> : <MessageSquareQuote size={18} />}
          <span>{message || "Ready. Connect a funded Aeneid wallet when you want to create a live vault."}</span>
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
              <h2 id="intro-title">Create a real CDR vault, then recover it from the dashboard.</h2>
              <p>
                First connect an email to launch the app. Then the dashboard opens the BlackBox chamber with wallet
                details, payment gate information, CDR vault creation, and reveal/recovery.
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
  conditionContract?: Address;
  onConnect: () => void;
}) {
  const selected = props.selected;
  const readCondition = selected?.conditionContract ?? props.conditionContract;
  const writeCondition = selected?.conditionContract ?? props.conditionContract;

  return (
    <section className="panel account-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">wallet and payment gate</p>
          <h3>Account Control</h3>
        </div>
        <Wallet size={22} />
      </div>
      <div className="account-grid">
        <InfoTile label="Email" value={props.connectedEmail || "not connected"} />
        <InfoTile label="Wallet" value={props.account ? shortHash(props.account) : "not connected"} />
        <InfoTile label="Unlock price" value={selected?.priceLabel ?? "select an oracle"} />
        <InfoTile label="Payment gate" value={selected?.accessMode === "paid" ? "paid contract" : "owner proof"} />
        <InfoTile label="Read condition" value={readCondition ? shortHash(readCondition) : "not configured"} />
        <InfoTile label="Write condition" value={writeCondition ? shortHash(writeCondition) : "not configured"} />
      </div>
      <div className="account-tease">
        <p className="eyebrow">public tease</p>
        <strong>{selected?.publicTease ?? "Select or create a live BlackBox to see its public tease."}</strong>
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
          <h3>Sealed Oracles</h3>
        </div>
        <button className="icon-button" onClick={props.refresh} title="Refresh listings">
          <RefreshCw size={18} />
        </button>
      </div>

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
  question: string;
  setQuestion: (question: string) => void;
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
        <button className="icon-button" onClick={props.copySelected} title="Copy oracle metadata">
          <Copy size={18} />
        </button>
      </div>
      <p className="tease">{selected.publicTease}</p>
      <div className="detail-grid">
        <InfoTile label="Unlock" value={selected.priceLabel} />
        <InfoTile label="Vault" value={selected.vaultUuid ? `#${selected.vaultUuid}` : "not sealed yet"} />
        <InfoTile label="Mode" value={selected.accessMode === "paid" ? "paid access" : "owner proof"} />
      </div>
      {selected.vaultUuid || selected.conditionContract || selected.owner ? (
        <ProofLinks selected={selected} />
      ) : null}
      <div className="flow-rail" aria-label="Oracle unlock flow">
        <FlowStep label="Public tease" active />
        <FlowStep label="Payment gate" active={Boolean(selected.vaultUuid)} />
        <FlowStep label="CDR reveal" active={Boolean(props.revealedSecret)} />
      </div>
      <div className="weird-box">
        <Sparkles size={18} />
        <span>{selected.weirdness}</span>
      </div>
      <label className="field-label" htmlFor="question">
        Ask the box
      </label>
      <textarea
        id="question"
        value={props.question}
        onChange={(event) => props.setQuestion(event.target.value)}
        rows={3}
      />
      {selected.accessMode === "paid" && props.account !== selected.owner ? (
        <button className="secondary-action" onClick={props.onBuyAccess}>
          <CircleDollarSign size={18} />
          Buy Access
        </button>
      ) : null}
      <button className="primary-action" onClick={props.onReveal}>
        <Eye size={18} />
        {selected.vaultUuid ? "Request Decryption" : "Try Live Vault"}
      </button>
      {props.revealedSecret ? (
        <div className="reveal">
          <p className="eyebrow">oracle answer</p>
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
        Title of private data
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="The Anti-Resume Oracle"
        />
      </label>
      <label>
        Private data type
        <input
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder="Private Data"
        />
      </label>
      <label>
        Data unlock price
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
          placeholder="What buyers can know before unlock."
          rows={3}
        />
      </label>
      <label>
        Private answer
        <textarea
          value={form.secret}
          onChange={(event) => setForm({ ...form, secret: event.target.value })}
          placeholder="This text is encrypted into a CDR vault."
          rows={5}
        />
      </label>
      <label>
        Demo hook
        <textarea
          value={form.weirdness}
          onChange={(event) => setForm({ ...form, weirdness: event.target.value })}
          placeholder="Why judges remember this oracle."
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

function StatusPill(props: { icon: React.ReactNode; label: string }) {
  return (
    <div className="status-pill">
      {props.icon}
      <span>{props.label}</span>
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

function ProofItem(props: { label: string; value: string }) {
  return (
    <div className="proof-item">
      <small>{props.label}</small>
      <strong>{props.value}</strong>
    </div>
  );
}

function HowStep(props: { index: string; title: string; text: string }) {
  return (
    <div className="how-step">
      <span>{props.index}</span>
      <strong>{props.title}</strong>
      <p>{props.text}</p>
    </div>
  );
}

function FlowStep(props: { label: string; active: boolean }) {
  return (
    <div className={`flow-step ${props.active ? "active" : ""}`}>
      <span />
      <small>{props.label}</small>
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
