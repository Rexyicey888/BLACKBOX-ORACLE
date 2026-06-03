// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICDRWriteCondition {
    function checkWriteCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool);
}

interface ICDRReadCondition {
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool);
}

contract BlackBoxAccessCondition is ICDRWriteCondition, ICDRReadCondition {
    struct Listing {
        address owner;
        uint256 price;
        bool active;
    }

    mapping(uint32 => mapping(address => Listing)) public listings;
    mapping(uint32 => mapping(address => mapping(address => bool))) public canRead;

    bool private _locked;

    event ListingConfigured(uint32 indexed uuid, address indexed owner, uint256 price);
    event ListingDeactivated(uint32 indexed uuid, address indexed owner);
    event AccessPurchased(uint32 indexed uuid, address indexed owner, address indexed buyer, uint256 price);
    event AccessRevoked(uint32 indexed uuid, address indexed owner, address indexed buyer);

    modifier nonReentrant() {
        require(!_locked, "REENTRANT");
        _locked = true;
        _;
        _locked = false;
    }

    function configureListing(uint32 uuid, address owner, uint256 price) external {
        require(owner != address(0), "INVALID_OWNER");
        require(msg.sender == owner, "NOT_OWNER");

        listings[uuid][owner] = Listing({
            owner: owner,
            price: price,
            active: true
        });

        canRead[uuid][owner][owner] = true;

        emit ListingConfigured(uuid, owner, price);
    }

    function deactivateListing(uint32 uuid) external {
        Listing storage listing = listings[uuid][msg.sender];
        require(listing.owner == msg.sender, "NOT_OWNER");

        listing.active = false;

        emit ListingDeactivated(uuid, msg.sender);
    }

    function reactivateListing(uint32 uuid) external {
        Listing storage listing = listings[uuid][msg.sender];
        require(listing.owner == msg.sender, "NOT_OWNER");

        listing.active = true;

        emit ListingConfigured(uuid, msg.sender, listing.price);
    }

    function revokeAccess(uint32 uuid, address buyer) external {
        Listing memory listing = listings[uuid][msg.sender];
        require(listing.owner == msg.sender, "NOT_OWNER");
        require(buyer != msg.sender, "CANNOT_REVOKE_OWNER");

        canRead[uuid][listing.owner][buyer] = false;

        emit AccessRevoked(uuid, listing.owner, buyer);
    }

    function buyAccess(uint32 uuid, address owner) external payable nonReentrant {
        Listing memory listing = listings[uuid][owner];
        require(listing.owner != address(0), "UNCONFIGURED_LISTING");
        require(listing.active, "INACTIVE_LISTING");
        require(msg.value >= listing.price, "INSUFFICIENT_PAYMENT");

        canRead[uuid][listing.owner][msg.sender] = true;

        (bool sent,) = payable(listing.owner).call{ value: listing.price }("");
        require(sent, "PAYMENT_FAILED");

        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refunded,) = payable(msg.sender).call{ value: excess }("");
            require(refunded, "REFUND_FAILED");
        }

        emit AccessPurchased(uuid, listing.owner, msg.sender, listing.price);
    }

    function checkWriteCondition(
        uint32,
        bytes calldata,
        bytes calldata conditionData,
        address caller
    ) external pure returns (bool) {
        address owner = abi.decode(conditionData, (address));
        return owner != address(0) && caller == owner;
    }

    function checkReadCondition(
        uint32 uuid,
        bytes calldata,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        address owner = abi.decode(conditionData, (address));
        Listing memory listing = listings[uuid][owner];

        return listing.owner == owner && (caller == owner || canRead[uuid][owner][caller]);
    }
}
