# Blockchain Supply Chain DApp
### CN6035 — Mobile & Distributed Systems
**Student:** Marwan Eltahan | **ID:** u2748952

A decentralised pharmaceutical supply chain management system built on Ethereum.
Forked and significantly improved from [faizack/Supply-Chain-Blockchain](https://github.com/faizack/Supply-Chain-Blockchain).

---

## Improvements Over Base Project

### Smart Contract
- Added 4 on-chain events: `MedicineOrdered`, `StageUpdated`, `MedicineSold`, `RoleAdded`
- Added per-stage timestamps via `block.timestamp` and `getTimestamps()`
- Added descriptive error messages to all `require()` statements
- Added input validation (zero address check, empty string checks)
- Added NatSpec comments throughout

### Back-End (NEW — not in base project)
- Built `server.js` — Express REST API with SQLite event indexer
- Listens for smart contract events via ethers.js and stores them in SQLite
- Endpoints: `GET /products`, `GET /product/:id`, `GET /health`

### Front-End
- Added visual progress bar per product (0–100%)
- Added on-chain timestamps displayed at each stage
- Added API integration — queries back-end first, falls back to blockchain
- Added live data source badge (API vs blockchain)
- Added unified product detail view with full event history table

---

## Prerequisites

- [Node.js v18+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [MetaMask browser extension](https://metamask.io/) (Chrome recommended)

---

## Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/mirolego1/blockchain-supply-chain-cn6035.git
cd blockchain-supply-chain-cn6035
```

### 2. Install dependencies
```bash
cd backend
npm install
cd ../client
npm install
cd ..
```

### 3. Configure MetaMask
Add a custom network to MetaMask:
- **Network name:** Hardhat Local
- **RPC URL:** http://127.0.0.1:8545
- **Chain ID:** 31337
- **Currency symbol:** ETH

Import the test account using this private key:
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

This is Hardhat's default Account #0 with 10,000 test ETH.

---

## Running the App

Open **3 terminals** and run one command in each:

**Terminal 1 — Start local blockchain:**
```bash
cd backend
npx hardhat node
```

**Terminal 2 — Deploy smart contract:**
```bash
cd backend
npx hardhat run scripts/deploy.ts --network localhost
```

**Terminal 3 — Start front-end:**
```bash
cd client
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## Using the App

1. **Register Roles** — Add participants (use any of the Hardhat test addresses)
2. **Order Materials** — Create a new product as the owner
3. **Supply Materials** — Progress the product through each stage
4. **Track Materials** — View the full supply chain journey with timestamps

### Hardhat Test Accounts
| Role | Address | Private Key |
|------|---------|-------------|
| Owner | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 |
| RMS | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| Manufacturer | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 0x5de4111afa1ad4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |
| Distributor | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 |
| Retailer | 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 | 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a |

---

## Running Tests

```bash
cd backend
npx hardhat test
```

22 tests covering events, timestamps, input validation and role-based access.

---

## Firefox Users

If MetaMask shows RPC errors in Firefox, go to `about:config` and set:
network.proxy.allow_hijacking_localhost = true

---

## Starting the Back-End API (optional)

```bash
cd backend
node server.js
```

API will run at **http://localhost:4000**

---

## Links
- **This repository:** https://github.com/mirolego1/blockchain-supply-chain-cn6035
- **Original project:** https://github.com/faizack/Supply-Chain-Blockchain