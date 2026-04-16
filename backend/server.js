/**
 * server.js
 * Enhanced back-end for the Supply Chain DApp (NEW - not in base project)
 *
 * Features:
 *  - Connects to the deployed SupplyChain smart contract via ethers.js
 *  - Listens for on-chain events and indexes them into a local SQLite database
 *  - Exposes a REST API so the front-end can query product history efficiently
 *    without hitting the blockchain on every request
 */

const express = require("express");
const cors = require("cors");
const ethers = require("ethers");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------------
// DATABASE SETUP
// -------------------------------------------------------------------------

// Create (or open) a local SQLite database file
const db = new Database(path.join(__dirname, "supplychain.db"));

// Create tables if they don't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY,
    name TEXT,
    stage TEXT,
    ordered_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS stage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER,
    stage TEXT,
    updated_by TEXT,
    timestamp INTEGER
  );
`);

console.log("Database ready.");

// -------------------------------------------------------------------------
// SMART CONTRACT CONNECTION
// -------------------------------------------------------------------------

// Load the contract ABI from Hardhat's compiled artifacts
const artifactPath = path.join(
  __dirname,
  "artifacts/contracts/SupplyChain.sol/SupplyChain.json"
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const CONTRACT_ABI = artifact.abi;

// Load the deployed contract address
const deploymentsPath = path.join(__dirname, "../client/src/deployments.json");

let CONTRACT_ADDRESS = null;
if (fs.existsSync(deploymentsPath)) {
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const network = deployments.networks["31337"] || deployments.networks["1337"];
  if (network && network.SupplyChain) {
    CONTRACT_ADDRESS = network.SupplyChain.address;
  }
}

// Connect to local Hardhat/Ganache node
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

let contract = null;

if (CONTRACT_ADDRESS) {
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  console.log(`Connected to contract at ${CONTRACT_ADDRESS}`);
  startListening();
} else {
  console.warn(
    "No contract address found. Deploy the contract first, then restart the server."
  );
}

// -------------------------------------------------------------------------
// EVENT LISTENERS (NEW - indexes blockchain events into SQLite)
// -------------------------------------------------------------------------

function startListening() {
  // Listen for new medicine orders
  contract.on("MedicineOrdered", (medicineId, name, timestamp) => {
    console.log(`MedicineOrdered: ID=${medicineId}, Name=${name}`);
    const insert = db.prepare(
      "INSERT OR REPLACE INTO medicines (id, name, stage, ordered_at) VALUES (?, ?, ?, ?)"
    );
    insert.run(Number(medicineId), name, "Medicine Ordered", Number(timestamp));
  });

  // Listen for stage updates
  contract.on("StageUpdated", (medicineId, stage, updatedBy, timestamp) => {
    const stageNames = [
      "Medicine Ordered",
      "Raw Material Supply",
      "Manufacturing",
      "Distribution",
      "Retail",
      "Sold",
    ];
    const stageName = stageNames[Number(stage)] || "Unknown";
    console.log(`StageUpdated: ID=${medicineId}, Stage=${stageName}`);

    // Update the medicine's current stage
    const update = db.prepare(
      "UPDATE medicines SET stage = ? WHERE id = ?"
    );
    update.run(stageName, Number(medicineId));

    // Insert a stage history event
    const insert = db.prepare(
      "INSERT INTO stage_events (medicine_id, stage, updated_by, timestamp) VALUES (?, ?, ?, ?)"
    );
    insert.run(Number(medicineId), stageName, updatedBy, Number(timestamp));
  });

  // Listen for sold events
  contract.on("MedicineSold", (medicineId, timestamp) => {
    console.log(`MedicineSold: ID=${medicineId}`);
    const update = db.prepare(
      "UPDATE medicines SET stage = ? WHERE id = ?"
    );
    update.run("Sold", Number(medicineId));
  });

  console.log("Listening for contract events...");
}

// -------------------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------------------

/**
 * GET /products
 * Returns all medicines currently indexed in the database
 */
app.get("/products", (req, res) => {
  const rows = db.prepare("SELECT * FROM medicines").all();
  res.json(rows);
});

/**
 * GET /product/:id
 * Returns a single medicine and its full stage history
 */
app.get("/product/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const medicine = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);

  if (!medicine) {
    return res.status(404).json({ error: "Product not found" });
  }

  const history = db
    .prepare(
      "SELECT * FROM stage_events WHERE medicine_id = ? ORDER BY timestamp ASC"
    )
    .all(id);

  res.json({ medicine, history });
});

/**
 * GET /health
 * Simple health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", contract: CONTRACT_ADDRESS });
});

// -------------------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------------------

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Supply Chain API running at http://localhost:${PORT}`);
});