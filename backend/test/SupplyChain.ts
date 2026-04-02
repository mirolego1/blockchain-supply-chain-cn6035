import { expect } from 'chai'
import { ethers } from 'hardhat'

/**
 * SupplyChain.ts - Enhanced test suite
 * 
 * Tests added over base project:
 *  - Input validation (empty strings, zero address)
 *  - Event emission verification (MedicineOrdered, StageUpdated, MedicineSold, RoleAdded)
 *  - Timestamp recording per stage (getTimestamps)
 *  - Error messages on require() statements
 *  - Only assigned retailer can mark as sold
 */

describe('SupplyChain', () => {

  // -------------------------------------------------------------------------
  // SHARED FIXTURE — deploys contract and registers all roles
  // -------------------------------------------------------------------------

  async function deployFixture() {
    const [owner, rms, man, dis, ret, other] = await ethers.getSigners()
    const SupplyChain = await ethers.getContractFactory('SupplyChain')
    const supplyChain = await SupplyChain.deploy()
    await supplyChain.waitForDeployment()
    return { supplyChain, owner, rms, man, dis, ret, other }
  }

  async function deployWithRoles() {
    const { supplyChain, owner, rms, man, dis, ret, other } = await deployFixture()
    await supplyChain.connect(owner).addRMS(rms.address, 'RMS Corp', 'London')
    await supplyChain.connect(owner).addManufacturer(man.address, 'MAN Corp', 'Berlin')
    await supplyChain.connect(owner).addDistributor(dis.address, 'DIS Corp', 'Paris')
    await supplyChain.connect(owner).addRetailer(ret.address, 'RET Corp', 'Madrid')
    return { supplyChain, owner, rms, man, dis, ret, other }
  }

  async function deployWithMedicine() {
    const { supplyChain, owner, rms, man, dis, ret, other } = await deployWithRoles()
    await supplyChain.connect(owner).addMedicine('Paracetamol', 'Pain relief medicine')
    return { supplyChain, owner, rms, man, dis, ret, other }
  }

  // -------------------------------------------------------------------------
  // DEPLOYMENT
  // -------------------------------------------------------------------------

  describe('Deployment', () => {
    it('sets the deployer as Owner', async () => {
      const { supplyChain, owner } = await deployFixture()
      expect(await supplyChain.Owner()).to.equal(owner.address)
    })

    it('initialises all counters to zero', async () => {
      const { supplyChain } = await deployFixture()
      expect(await supplyChain.medicineCtr()).to.equal(0n)
      expect(await supplyChain.rmsCtr()).to.equal(0n)
      expect(await supplyChain.manCtr()).to.equal(0n)
      expect(await supplyChain.disCtr()).to.equal(0n)
      expect(await supplyChain.retCtr()).to.equal(0n)
    })
  })

  // -------------------------------------------------------------------------
  // ROLE REGISTRATION
  // -------------------------------------------------------------------------

  describe('Role registration', () => {
    it('allows owner to register all roles', async () => {
      const { supplyChain } = await deployWithRoles()
      expect(await supplyChain.rmsCtr()).to.equal(1n)
      expect(await supplyChain.manCtr()).to.equal(1n)
      expect(await supplyChain.disCtr()).to.equal(1n)
      expect(await supplyChain.retCtr()).to.equal(1n)
    })

    it('reverts if non-owner tries to register a role', async () => {
      const { supplyChain, other, rms } = await deployFixture()
      await expect(
        supplyChain.connect(other).addRMS(rms.address, 'RMS', 'City')
      ).to.be.revertedWith('Only owner can call this function')
    })

    // NEW: Input validation tests — not in base project
    it('reverts addRMS with zero address', async () => {
      const { supplyChain, owner } = await deployFixture()
      await expect(
        supplyChain.connect(owner).addRMS(ethers.ZeroAddress, 'RMS', 'City')
      ).to.be.revertedWith('Invalid address')
    })

    it('reverts addRMS with empty name', async () => {
      const { supplyChain, owner, rms } = await deployFixture()
      await expect(
        supplyChain.connect(owner).addRMS(rms.address, '', 'City')
      ).to.be.revertedWith('Name cannot be empty')
    })

    it('reverts addRMS with empty place', async () => {
      const { supplyChain, owner, rms } = await deployFixture()
      await expect(
        supplyChain.connect(owner).addRMS(rms.address, 'RMS', '')
      ).to.be.revertedWith('Place cannot be empty')
    })

    // NEW: Event emission test — not in base project
    it('emits RoleAdded event when registering a role', async () => {
      const { supplyChain, owner, rms } = await deployFixture()
      await expect(
        supplyChain.connect(owner).addRMS(rms.address, 'RMS Corp', 'London')
      )
        .to.emit(supplyChain, 'RoleAdded')
        .withArgs('RawMaterialSupplier', rms.address, 'RMS Corp', (ts: bigint) => ts > 0n)
    })
  })

  // -------------------------------------------------------------------------
  // MEDICINE MANAGEMENT
  // -------------------------------------------------------------------------

  describe('Medicine management', () => {
    it('reverts addMedicine if no roles are registered', async () => {
      const { supplyChain, owner } = await deployFixture()
      await expect(
        supplyChain.connect(owner).addMedicine('Med', 'Desc')
      ).to.be.revertedWith('All roles must be registered first')
    })

    it('reverts addMedicine with empty name', async () => {
      const { supplyChain, owner } = await deployWithRoles()
      await expect(
        supplyChain.connect(owner).addMedicine('', 'Desc')
      ).to.be.revertedWith('Medicine name cannot be empty')
    })

    it('reverts addMedicine with empty description', async () => {
      const { supplyChain, owner } = await deployWithRoles()
      await expect(
        supplyChain.connect(owner).addMedicine('Med', '')
      ).to.be.revertedWith('Description cannot be empty')
    })

    it('allows owner to add medicine after all roles registered', async () => {
      const { supplyChain, owner } = await deployWithRoles()
      await expect(
        supplyChain.connect(owner).addMedicine('Paracetamol', 'Pain relief')
      ).to.not.be.reverted

      expect(await supplyChain.medicineCtr()).to.equal(1n)
      const medicine = await supplyChain.MedicineStock(1)
      expect(medicine.name).to.equal('Paracetamol')
      expect(medicine.description).to.equal('Pain relief')
    })

    // NEW: Event emission test — not in base project
    it('emits MedicineOrdered event when medicine is added', async () => {
      const { supplyChain, owner } = await deployWithRoles()
      await expect(
        supplyChain.connect(owner).addMedicine('Paracetamol', 'Pain relief')
      )
        .to.emit(supplyChain, 'MedicineOrdered')
        .withArgs(1n, 'Paracetamol', (ts: bigint) => ts > 0n)
    })

    // NEW: Timestamp test — not in base project
    it('records orderedAt timestamp when medicine is added', async () => {
      const { supplyChain, owner } = await deployWithRoles()
      await supplyChain.connect(owner).addMedicine('Paracetamol', 'Pain relief')
      const ts = await supplyChain.getTimestamps(1)
      expect(ts[0]).to.be.gt(0n) // orderedAt should be set
      expect(ts[1]).to.equal(0n) // rmsAt should not be set yet
    })
  })

  // -------------------------------------------------------------------------
  // SUPPLY CHAIN STAGE PROGRESSION
  // -------------------------------------------------------------------------

  describe('Stage progression', () => {
    it('progresses through all stages correctly', async () => {
      const { supplyChain, rms, man, dis, ret } = await deployWithMedicine()

      await supplyChain.connect(rms).RMSsupply(1)
      expect(await supplyChain.showStage(1)).to.equal('Raw Material Supply Stage')

      await supplyChain.connect(man).Manufacturing(1)
      expect(await supplyChain.showStage(1)).to.equal('Manufacturing Stage')

      await supplyChain.connect(dis).Distribute(1)
      expect(await supplyChain.showStage(1)).to.equal('Distribution Stage')

      await supplyChain.connect(ret).Retail(1)
      expect(await supplyChain.showStage(1)).to.equal('Retail Stage')

      await supplyChain.connect(ret).sold(1)
      expect(await supplyChain.showStage(1)).to.equal('Medicine Sold')
    })

    it('reverts when wrong role tries to supply raw materials', async () => {
      const { supplyChain, other } = await deployWithMedicine()
      await expect(
        supplyChain.connect(other).RMSsupply(1)
      ).to.be.revertedWith('Caller is not a registered RMS')
    })

    it('reverts when stage is out of order', async () => {
      const { supplyChain, man } = await deployWithMedicine()
      await expect(
        supplyChain.connect(man).Manufacturing(1)
      ).to.be.revertedWith('Medicine not in correct stage')
    })

    it('reverts when invalid medicine ID is used', async () => {
      const { supplyChain, rms } = await deployWithMedicine()
      await expect(
        supplyChain.connect(rms).RMSsupply(99)
      ).to.be.revertedWith('Invalid medicine ID')
    })

    // NEW: Event tests — not in base project
    it('emits StageUpdated event on each stage transition', async () => {
      const { supplyChain, rms } = await deployWithMedicine()
      await expect(supplyChain.connect(rms).RMSsupply(1))
        .to.emit(supplyChain, 'StageUpdated')
        .withArgs(1n, 1n, rms.address, (ts: bigint) => ts > 0n)
    })

    it('emits MedicineSold event when medicine is sold', async () => {
      const { supplyChain, rms, man, dis, ret } = await deployWithMedicine()
      await supplyChain.connect(rms).RMSsupply(1)
      await supplyChain.connect(man).Manufacturing(1)
      await supplyChain.connect(dis).Distribute(1)
      await supplyChain.connect(ret).Retail(1)
      await expect(supplyChain.connect(ret).sold(1))
        .to.emit(supplyChain, 'MedicineSold')
        .withArgs(1n, (ts: bigint) => ts > 0n)
    })

    // NEW: Timestamp tests — not in base project
    it('records timestamps at each stage', async () => {
      const { supplyChain, rms, man, dis, ret } = await deployWithMedicine()

      await supplyChain.connect(rms).RMSsupply(1)
      let ts = await supplyChain.getTimestamps(1)
      expect(ts[1]).to.be.gt(0n) // rmsAt set

      await supplyChain.connect(man).Manufacturing(1)
      ts = await supplyChain.getTimestamps(1)
      expect(ts[2]).to.be.gt(0n) // manufacturedAt set

      await supplyChain.connect(dis).Distribute(1)
      ts = await supplyChain.getTimestamps(1)
      expect(ts[3]).to.be.gt(0n) // distributedAt set

      await supplyChain.connect(ret).Retail(1)
      ts = await supplyChain.getTimestamps(1)
      expect(ts[4]).to.be.gt(0n) // retailedAt set

      await supplyChain.connect(ret).sold(1)
      ts = await supplyChain.getTimestamps(1)
      expect(ts[5]).to.be.gt(0n) // soldAt set
    })

    // NEW: Only assigned retailer can sell — not tested in base project
    it('reverts when a different retailer tries to mark as sold', async () => {
      const { supplyChain, owner, rms, man, dis, ret, other } = await deployWithMedicine()

      // Register a second retailer
      await supplyChain.connect(owner).addRetailer(other.address, 'RET2', 'Rome')

      await supplyChain.connect(rms).RMSsupply(1)
      await supplyChain.connect(man).Manufacturing(1)
      await supplyChain.connect(dis).Distribute(1)
      await supplyChain.connect(ret).Retail(1)

      // other is a valid retailer but not the one assigned to this medicine
      await expect(
        supplyChain.connect(other).sold(1)
      ).to.be.revertedWith('Only the assigned retailer can mark as sold')
    })
  })
})