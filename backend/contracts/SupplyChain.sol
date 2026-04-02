// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SupplyChain
 * @dev Enhanced pharmaceutical supply chain management system on Ethereum.
 *      Tracks products through 6 stages: Order → RMS → Manufacture → Distribution → Retail → Sold.
 *      Improvements over base project:
 *        - Events emitted at every stage transition for off-chain indexing
 *        - Timestamps recorded on-chain per stage
 *        - Input validation with descriptive error messages on all require() calls
 *        - Empty string checks on all role registration functions
 */
contract SupplyChain {

    // Address of the contract deployer — only they can register roles and add medicines
    address public Owner;

    // Set the contract deployer as the owner on deployment
    constructor() {
        Owner = msg.sender;
    }

    // Restricts function access to the contract owner only
    modifier onlyByOwner() {
        require(msg.sender == Owner, "Only owner can call this function");
        _;
    }

    // -------------------------------------------------------------------------
    // ENUMS
    // -------------------------------------------------------------------------

    /**
     * @dev Represents the current stage of a medicine in the supply chain.
     *      Stages must be completed in order — no skipping allowed.
     */
    enum STAGE {
        Init,               // 0 - Medicine has been ordered
        RawMaterialSupply,  // 1 - Raw materials have been supplied
        Manufacture,        // 2 - Medicine has been manufactured
        Distribution,       // 3 - Medicine is being distributed
        Retail,             // 4 - Medicine is at the retailer
        sold                // 5 - Medicine has been sold to consumer
    }

    // -------------------------------------------------------------------------
    // EVENTS (NEW - not in base project)
    // -------------------------------------------------------------------------

    /// @dev Emitted when a new medicine order is created by the owner
    event MedicineOrdered(uint256 indexed medicineId, string name, uint256 timestamp);

    /// @dev Emitted when a medicine progresses to a new stage
    event StageUpdated(uint256 indexed medicineId, STAGE stage, address updatedBy, uint256 timestamp);

    /// @dev Emitted when a medicine is marked as sold by the retailer
    event MedicineSold(uint256 indexed medicineId, uint256 timestamp);

    /// @dev Emitted when a new participant role is registered by the owner
    event RoleAdded(string role, address addr, string name, uint256 timestamp);

    // -------------------------------------------------------------------------
    // COUNTERS
    // -------------------------------------------------------------------------

    uint256 public medicineCtr = 0; // Total number of medicines ordered
    uint256 public rmsCtr = 0;      // Total number of raw material suppliers
    uint256 public manCtr = 0;      // Total number of manufacturers
    uint256 public disCtr = 0;      // Total number of distributors
    uint256 public retCtr = 0;      // Total number of retailers

    // -------------------------------------------------------------------------
    // STRUCTS
    // -------------------------------------------------------------------------

    /**
     * @dev Stores all information about a medicine, including which participant
     *      handled it at each stage and the timestamp of each transition.
     *      Timestamps are NEW — not present in the base project.
     */
    struct medicine {
        uint256 id;           // Unique medicine ID
        string name;          // Name of the medicine
        string description;   // Description of the medicine
        uint256 RMSid;        // ID of the raw material supplier assigned
        uint256 MANid;        // ID of the manufacturer assigned
        uint256 DISid;        // ID of the distributor assigned
        uint256 RETid;        // ID of the retailer assigned
        STAGE stage;          // Current stage in the supply chain

        // On-chain timestamps per stage (NEW)
        uint256 orderedAt;      // When the medicine was ordered
        uint256 rmsAt;          // When raw materials were supplied
        uint256 manufacturedAt; // When manufacturing was completed
        uint256 distributedAt;  // When distribution began
        uint256 retailedAt;     // When it reached the retailer
        uint256 soldAt;         // When it was sold to the consumer
    }

    // Stores all medicines indexed by their ID
    mapping(uint256 => medicine) public MedicineStock;

    /// @dev Stores information about a raw material supplier
    struct rawMaterialSupplier {
        address addr;  // Ethereum address of the supplier
        uint256 id;    // Unique supplier ID
        string name;   // Name of the supplier
        string place;  // Location of the supplier
    }

    /// @dev Stores information about a manufacturer
    struct manufacturer {
        address addr;  // Ethereum address of the manufacturer
        uint256 id;    // Unique manufacturer ID
        string name;   // Name of the manufacturer
        string place;  // Location of the manufacturer
    }

    /// @dev Stores information about a distributor
    struct distributor {
        address addr;  // Ethereum address of the distributor
        uint256 id;    // Unique distributor ID
        string name;   // Name of the distributor
        string place;  // Location of the distributor
    }

    /// @dev Stores information about a retailer
    struct retailer {
        address addr;  // Ethereum address of the retailer
        uint256 id;    // Unique retailer ID
        string name;   // Name of the retailer
        string place;  // Location of the retailer
    }

    // Mappings to store all participants by their ID
    mapping(uint256 => rawMaterialSupplier) public RMS;
    mapping(uint256 => manufacturer) public MAN;
    mapping(uint256 => distributor) public DIS;
    mapping(uint256 => retailer) public RET;

    // -------------------------------------------------------------------------
    // ROLE REGISTRATION (Owner only)
    // -------------------------------------------------------------------------

    /**
     * @dev Registers a new raw material supplier.
     *      Input validation added over base project — rejects empty strings and zero address.
     */
    function addRMS(address _address, string memory _name, string memory _place) public onlyByOwner() {
        require(_address != address(0), "Invalid address");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_place).length > 0, "Place cannot be empty");
        rmsCtr++;
        RMS[rmsCtr] = rawMaterialSupplier(_address, rmsCtr, _name, _place);
        emit RoleAdded("RawMaterialSupplier", _address, _name, block.timestamp);
    }

    /**
     * @dev Registers a new manufacturer.
     *      Input validation added over base project — rejects empty strings and zero address.
     */
    function addManufacturer(address _address, string memory _name, string memory _place) public onlyByOwner() {
        require(_address != address(0), "Invalid address");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_place).length > 0, "Place cannot be empty");
        manCtr++;
        MAN[manCtr] = manufacturer(_address, manCtr, _name, _place);
        emit RoleAdded("Manufacturer", _address, _name, block.timestamp);
    }

    /**
     * @dev Registers a new distributor.
     *      Input validation added over base project — rejects empty strings and zero address.
     */
    function addDistributor(address _address, string memory _name, string memory _place) public onlyByOwner() {
        require(_address != address(0), "Invalid address");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_place).length > 0, "Place cannot be empty");
        disCtr++;
        DIS[disCtr] = distributor(_address, disCtr, _name, _place);
        emit RoleAdded("Distributor", _address, _name, block.timestamp);
    }

    /**
     * @dev Registers a new retailer.
     *      Input validation added over base project — rejects empty strings and zero address.
     */
    function addRetailer(address _address, string memory _name, string memory _place) public onlyByOwner() {
        require(_address != address(0), "Invalid address");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_place).length > 0, "Place cannot be empty");
        retCtr++;
        RET[retCtr] = retailer(_address, retCtr, _name, _place);
        emit RoleAdded("Retailer", _address, _name, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // SUPPLY CHAIN STAGE FUNCTIONS
    // -------------------------------------------------------------------------

    /**
     * @dev Called by a registered raw material supplier to advance the medicine
     *      from Init to RawMaterialSupply stage.
     *      Records timestamp and emits StageUpdated event (NEW).
     */
    function RMSsupply(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        uint256 _id = findRMS(msg.sender);
        require(_id > 0, "Caller is not a registered RMS");
        require(MedicineStock[_medicineID].stage == STAGE.Init, "Medicine not in correct stage");
        MedicineStock[_medicineID].RMSid = _id;
        MedicineStock[_medicineID].stage = STAGE.RawMaterialSupply;
        MedicineStock[_medicineID].rmsAt = block.timestamp;
        emit StageUpdated(_medicineID, STAGE.RawMaterialSupply, msg.sender, block.timestamp);
    }

    /**
     * @dev Called by a registered manufacturer to advance the medicine
     *      from RawMaterialSupply to Manufacture stage.
     *      Records timestamp and emits StageUpdated event (NEW).
     */
    function Manufacturing(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        uint256 _id = findMAN(msg.sender);
        require(_id > 0, "Caller is not a registered Manufacturer");
        require(MedicineStock[_medicineID].stage == STAGE.RawMaterialSupply, "Medicine not in correct stage");
        MedicineStock[_medicineID].MANid = _id;
        MedicineStock[_medicineID].stage = STAGE.Manufacture;
        MedicineStock[_medicineID].manufacturedAt = block.timestamp;
        emit StageUpdated(_medicineID, STAGE.Manufacture, msg.sender, block.timestamp);
    }

    /**
     * @dev Called by a registered distributor to advance the medicine
     *      from Manufacture to Distribution stage.
     *      Records timestamp and emits StageUpdated event (NEW).
     */
    function Distribute(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        uint256 _id = findDIS(msg.sender);
        require(_id > 0, "Caller is not a registered Distributor");
        require(MedicineStock[_medicineID].stage == STAGE.Manufacture, "Medicine not in correct stage");
        MedicineStock[_medicineID].DISid = _id;
        MedicineStock[_medicineID].stage = STAGE.Distribution;
        MedicineStock[_medicineID].distributedAt = block.timestamp;
        emit StageUpdated(_medicineID, STAGE.Distribution, msg.sender, block.timestamp);
    }

    /**
     * @dev Called by a registered retailer to advance the medicine
     *      from Distribution to Retail stage.
     *      Records timestamp and emits StageUpdated event (NEW).
     */
    function Retail(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        uint256 _id = findRET(msg.sender);
        require(_id > 0, "Caller is not a registered Retailer");
        require(MedicineStock[_medicineID].stage == STAGE.Distribution, "Medicine not in correct stage");
        MedicineStock[_medicineID].RETid = _id;
        MedicineStock[_medicineID].stage = STAGE.Retail;
        MedicineStock[_medicineID].retailedAt = block.timestamp;
        emit StageUpdated(_medicineID, STAGE.Retail, msg.sender, block.timestamp);
    }

    /**
     * @dev Called by the assigned retailer to mark the medicine as sold.
     *      Only the retailer who was assigned to this medicine can call this.
     *      Records timestamp and emits MedicineSold event (NEW).
     */
    function sold(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        uint256 _id = findRET(msg.sender);
        require(_id > 0, "Caller is not a registered Retailer");
        require(_id == MedicineStock[_medicineID].RETid, "Only the assigned retailer can mark as sold");
        require(MedicineStock[_medicineID].stage == STAGE.Retail, "Medicine not in correct stage");
        MedicineStock[_medicineID].stage = STAGE.sold;
        MedicineStock[_medicineID].soldAt = block.timestamp;
        emit MedicineSold(_medicineID, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // MEDICINE MANAGEMENT
    // -------------------------------------------------------------------------

    /**
     * @dev Creates a new medicine order. Only the owner can call this.
     *      Requires at least one participant of each role to be registered.
     *      Input validation added over base project — rejects empty name/description.
     *      Records orderedAt timestamp and emits MedicineOrdered event (NEW).
     */
    function addMedicine(string memory _name, string memory _description) public onlyByOwner() {
        require(rmsCtr > 0 && manCtr > 0 && disCtr > 0 && retCtr > 0, "All roles must be registered first");
        require(bytes(_name).length > 0, "Medicine name cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        medicineCtr++;
        MedicineStock[medicineCtr] = medicine(
            medicineCtr,
            _name,
            _description,
            0, 0, 0, 0,
            STAGE.Init,
            block.timestamp,
            0, 0, 0, 0, 0
        );
        emit MedicineOrdered(medicineCtr, _name, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // VIEW FUNCTIONS
    // -------------------------------------------------------------------------

    /**
     * @dev Returns a human-readable string of the current stage for a medicine.
     */
    function showStage(uint256 _medicineID) public view returns (string memory) {
        require(medicineCtr > 0, "No medicines in stock");
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        if (MedicineStock[_medicineID].stage == STAGE.Init)
            return "Medicine Ordered";
        else if (MedicineStock[_medicineID].stage == STAGE.RawMaterialSupply)
            return "Raw Material Supply Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Manufacture)
            return "Manufacturing Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Distribution)
            return "Distribution Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Retail)
            return "Retail Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.sold)
            return "Medicine Sold";
        return "Unknown Stage";
    }

    /**
     * @dev Returns all stage timestamps for a given medicine.
     *      Used by the back-end and front-end to display the product timeline (NEW).
     */
    function getTimestamps(uint256 _medicineID) public view returns (
        uint256 orderedAt,
        uint256 rmsAt,
        uint256 manufacturedAt,
        uint256 distributedAt,
        uint256 retailedAt,
        uint256 soldAt
    ) {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        medicine memory m = MedicineStock[_medicineID];
        return (m.orderedAt, m.rmsAt, m.manufacturedAt, m.distributedAt, m.retailedAt, m.soldAt);
    }

    // -------------------------------------------------------------------------
    // PRIVATE HELPER FUNCTIONS
    // -------------------------------------------------------------------------

    /// @dev Finds the ID of a registered RMS by their Ethereum address. Returns 0 if not found.
    function findRMS(address _address) private view returns (uint256) {
        require(rmsCtr > 0, "No RMS registered");
        for (uint256 i = 1; i <= rmsCtr; i++) {
            if (RMS[i].addr == _address) return RMS[i].id;
        }
        return 0;
    }

    /// @dev Finds the ID of a registered Manufacturer by their Ethereum address. Returns 0 if not found.
    function findMAN(address _address) private view returns (uint256) {
        require(manCtr > 0, "No Manufacturers registered");
        for (uint256 i = 1; i <= manCtr; i++) {
            if (MAN[i].addr == _address) return MAN[i].id;
        }
        return 0;
    }

    /// @dev Finds the ID of a registered Distributor by their Ethereum address. Returns 0 if not found.
    function findDIS(address _address) private view returns (uint256) {
        require(disCtr > 0, "No Distributors registered");
        for (uint256 i = 1; i <= disCtr; i++) {
            if (DIS[i].addr == _address) return DIS[i].id;
        }
        return 0;
    }

    /// @dev Finds the ID of a registered Retailer by their Ethereum address. Returns 0 if not found.
    function findRET(address _address) private view returns (uint256) {
        require(retCtr > 0, "No Retailers registered");
        for (uint256 i = 1; i <= retCtr; i++) {
            if (RET[i].addr == _address) return RET[i].id;
        }
        return 0;
    }
}