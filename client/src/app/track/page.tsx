'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadWeb3, getContract } from '@/lib/web3'
import { QRCodeCanvas } from 'qrcode.react'
import { parseTransactionError } from '@/lib/errorUtils'
import { showNotification } from '@/components/Notification'
import axios from 'axios'

// -------------------------------------------------------------------------
// INTERFACES
// -------------------------------------------------------------------------

interface Medicine {
  id: string
  name: string
  description: string
  RMSid: string
  MANid: string
  DISid: string
  RETid: string
  stage: string
}

interface Role {
  addr: string
  id: string
  name: string
  place: string
}

// NEW: Timestamps per stage from our improved smart contract
interface Timestamps {
  orderedAt: number
  rmsAt: number
  manufacturedAt: number
  distributedAt: number
  retailedAt: number
  soldAt: number
}

// NEW: Stage history event from our back-end API
interface StageEvent {
  stage: string
  updated_by: string
  timestamp: number
}

// -------------------------------------------------------------------------
// HELPER: Format a Unix timestamp into a readable date string
// NEW - not in base project
// -------------------------------------------------------------------------
const formatTimestamp = (ts: number): string => {
  if (!ts || ts === 0) return 'Pending'
  return new Date(ts * 1000).toLocaleString()
}

// -------------------------------------------------------------------------
// HELPER: Calculate progress percentage based on current stage
// NEW - not in base project
// -------------------------------------------------------------------------
const getStageProgress = (stage: number): number => {
  const progress: { [key: number]: number } = {
    0: 10,
    1: 30,
    2: 50,
    3: 70,
    4: 85,
    5: 100,
  }
  return progress[stage] ?? 0
}

const getStageColor = (stage: string): string => {
  if (stage.includes('Ordered')) return 'bg-blue-100 text-blue-700'
  if (stage.includes('Raw Material')) return 'bg-green-100 text-green-700'
  if (stage.includes('Manufacturing')) return 'bg-yellow-100 text-yellow-700'
  if (stage.includes('Distribution')) return 'bg-purple-100 text-purple-700'
  if (stage.includes('Retail')) return 'bg-orange-100 text-orange-700'
  if (stage.includes('Sold')) return 'bg-gray-100 text-gray-700'
  return 'bg-gray-100 text-gray-700'
}

// -------------------------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------------------------

export default function Track() {
  const router = useRouter()
  const [currentAccount, setCurrentAccount] = useState('')
  const [loader, setLoader] = useState(true)
  const [supplyChain, setSupplyChain] = useState<any>(null)
  const [med, setMed] = useState<{ [key: number]: Medicine }>({})
  const [medStage, setMedStage] = useState<{ [key: number]: string }>({})
  const [id, setId] = useState('')
  const [rms, setRMS] = useState<{ [key: number]: Role }>({})
  const [man, setMAN] = useState<{ [key: number]: Role }>({})
  const [dis, setDIS] = useState<{ [key: number]: Role }>({})
  const [ret, setRET] = useState<{ [key: number]: Role }>({})

  // NEW: Tracking state consolidated into a single selected medicine ID
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // NEW: Timestamps from smart contract
  const [timestamps, setTimestamps] = useState<Timestamps | null>(null)

  // NEW: Stage history from back-end API
  const [stageHistory, setStageHistory] = useState<StageEvent[]>([])

  // NEW: Whether data was fetched from API or directly from blockchain
  const [dataSource, setDataSource] = useState<'api' | 'blockchain' | null>(null)

  useEffect(() => {
    loadWeb3()
    loadBlockchainData()
  }, [])

  // -------------------------------------------------------------------------
  // LOAD BLOCKCHAIN DATA
  // -------------------------------------------------------------------------

  const loadBlockchainData = async () => {
    try {
      setLoader(true)
      const { contract, account } = await getContract()
      setSupplyChain(contract)
      setCurrentAccount(account)

      const medCtr = await contract.methods.medicineCtr().call()
      const medData: { [key: number]: Medicine } = {}
      const medStageData: { [key: number]: string } = {}

      for (let i = 0; i < medCtr; i++) {
        medData[i + 1] = await contract.methods.MedicineStock(i + 1).call()
        medStageData[i + 1] = await contract.methods.showStage(i + 1).call()
      }

      setMed(medData)
      setMedStage(medStageData)

      const rmsCtr = await contract.methods.rmsCtr().call()
      const rmsData: { [key: number]: Role } = {}
      for (let i = 0; i < rmsCtr; i++) {
        rmsData[i + 1] = await contract.methods.RMS(i + 1).call()
      }
      setRMS(rmsData)

      const manCtr = await contract.methods.manCtr().call()
      const manData: { [key: number]: Role } = {}
      for (let i = 0; i < manCtr; i++) {
        manData[i + 1] = await contract.methods.MAN(i + 1).call()
      }
      setMAN(manData)

      const disCtr = await contract.methods.disCtr().call()
      const disData: { [key: number]: Role } = {}
      for (let i = 0; i < disCtr; i++) {
        disData[i + 1] = await contract.methods.DIS(i + 1).call()
      }
      setDIS(disData)

      const retCtr = await contract.methods.retCtr().call()
      const retData: { [key: number]: Role } = {}
      for (let i = 0; i < retCtr; i++) {
        retData[i + 1] = await contract.methods.RET(i + 1).call()
      }
      setRET(retData)

      setLoader(false)
    } catch (err: any) {
      console.error('Error loading blockchain data:', err)
      const parsedError = parseTransactionError(err)
      showNotification(parsedError.message, 'error')
      setLoader(false)
    }
  }

  // -------------------------------------------------------------------------
  // TRACK A MEDICINE
  // NEW: Also fetches timestamps from contract and history from API
  // -------------------------------------------------------------------------

  const trackMedicine = async (medicineId: number) => {
    try {
      const ctr = await supplyChain.methods.medicineCtr().call()
      if (!(medicineId > 0 && medicineId <= parseInt(ctr))) {
        showNotification('Invalid Product ID!', 'error')
        return
      }

      setSelectedId(medicineId)

      // NEW: Fetch timestamps from our improved smart contract
      try {
        const ts = await supplyChain.methods.getTimestamps(medicineId).call()
        setTimestamps({
          orderedAt: Number(ts[0]),
          rmsAt: Number(ts[1]),
          manufacturedAt: Number(ts[2]),
          distributedAt: Number(ts[3]),
          retailedAt: Number(ts[4]),
          soldAt: Number(ts[5]),
        })
      } catch {
        setTimestamps(null)
      }

      // NEW: Try to fetch stage history from our back-end API
      try {
        const res = await axios.get(`http://localhost:4000/product/${medicineId}`)
        setStageHistory(res.data.history || [])
        setDataSource('api')
      } catch {
        // API not running — fall back to blockchain only
        setStageHistory([])
        setDataSource('blockchain')
      }

    } catch (err: any) {
      console.error('Error tracking medicine:', err)
      const parsedError = parseTransactionError(err)
      showNotification(parsedError.message, 'error')
    }
  }

  const handlerSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const medicineId = parseInt(id)
    if (isNaN(medicineId)) {
      showNotification('Please enter a valid Product ID!', 'error')
      return
    }
    await trackMedicine(medicineId)
  }

  const resetTracking = () => {
    setSelectedId(null)
    setTimestamps(null)
    setStageHistory([])
    setDataSource(null)
    setId('')
  }

  // -------------------------------------------------------------------------
  // LOADING SCREEN
  // -------------------------------------------------------------------------

  if (loader) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-700">Loading...</h1>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // TRACKING DETAIL VIEW
  // NEW: Unified view with progress bar, timestamps, and API history
  // -------------------------------------------------------------------------

  if (selectedId !== null) {
    const medicine = med[selectedId]
    const stage = parseInt(medicine?.stage ?? '0')
    const progress = getStageProgress(stage)

    const stageLabels = [
      { label: 'Ordered', key: 'orderedAt', roleKey: null },
      { label: 'Raw Material Supply', key: 'rmsAt', roleKey: 'RMSid' },
      { label: 'Manufacturing', key: 'manufacturedAt', roleKey: 'MANid' },
      { label: 'Distribution', key: 'distributedAt', roleKey: 'DISid' },
      { label: 'Retail', key: 'retailedAt', roleKey: 'RETid' },
      { label: 'Sold', key: 'soldAt', roleKey: null },
    ]

    const getRoleData = (roleKey: string | null): Role | undefined => {
      if (!roleKey) return undefined
      if (roleKey === 'RMSid') return rms[parseInt(medicine.RMSid)]
      if (roleKey === 'MANid') return man[parseInt(medicine.MANid)]
      if (roleKey === 'DISid') return dis[parseInt(medicine.DISid)]
      if (roleKey === 'RETid') return ret[parseInt(medicine.RETid)]
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-5">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-2xl p-8 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold">{medicine?.name}</h2>
                <p className="text-purple-100 text-sm mt-1">Product ID: {selectedId} · {medicine?.description}</p>
              </div>
              {/* NEW: Data source badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${dataSource === 'api' ? 'bg-green-400 text-green-900' : 'bg-yellow-400 text-yellow-900'}`}>
                {dataSource === 'api' ? '⚡ Live via API' : '🔗 Blockchain only'}
              </div>
            </div>

            {/* NEW: Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-purple-100 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-purple-100 mt-1">
                <span>Ordered</span>
                <span>Sold</span>
              </div>
            </div>
          </div>

          {/* NEW: Timeline with timestamps */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Supply Chain Journey</h3>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-purple-400 to-pink-400 hidden md:block"></div>
              <div className="space-y-6">
                {stageLabels.map((s, index) => {
                  const completed = stage >= index
                  const ts = timestamps ? timestamps[s.key as keyof Timestamps] : 0
                  const roleData = getRoleData(s.roleKey)

                  return (
                    <div key={index} className="relative flex items-start">
                      {/* Stage dot */}
                      <div className={`relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center shadow-lg text-white font-bold text-lg
                        ${completed ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gray-200 text-gray-400'}`}>
                        {completed ? '✓' : index + 1}
                      </div>

                      {/* Stage card */}
                      <div className={`ml-6 flex-1 rounded-xl p-5 shadow-md border-l-4
                        ${completed ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-lg font-bold text-gray-800">{s.label}</h5>
                          {/* NEW: Timestamp badge */}
                          <span className={`text-xs px-2 py-1 rounded-full font-mono
                            ${ts && ts > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {formatTimestamp(ts)}
                          </span>
                        </div>

                        {/* Role details */}
                        {roleData ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-xs text-gray-500 mb-1">Name</div>
                              <div className="font-semibold text-gray-800">{roleData.name}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-xs text-gray-500 mb-1">Location</div>
                              <div className="font-semibold text-gray-800">{roleData.place}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-xs text-gray-500 mb-1">Address</div>
                              <div className="font-mono text-xs text-gray-600 break-all">{roleData.addr}</div>
                            </div>
                          </div>
                        ) : completed ? (
                          <p className="text-sm text-purple-600 font-medium mt-1">✓ Completed</p>
                        ) : (
                          <p className="text-sm text-gray-400 mt-1">⏳ Not yet reached</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* NEW: Stage history from API */}
          {stageHistory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Event History <span className="text-xs font-normal text-green-600 ml-2">from API index</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50">
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Stage</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Updated By</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stageHistory.map((event, i) => (
                      <tr key={i} className="hover:bg-purple-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{event.stage}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500 break-all">{event.updated_by}</td>
                        <td className="px-4 py-2 text-gray-600">{formatTimestamp(event.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">QR Code</h3>
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
                <QRCodeCanvas
                  value={JSON.stringify({
                    id: medicine?.id,
                    name: medicine?.name,
                    description: medicine?.description,
                    currentStage: medStage[selectedId],
                  })}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
                <p className="text-center text-sm text-gray-600 mt-3 font-semibold">
                  Scan to verify product authenticity
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={resetTracking}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
            >
              ← Track Another Item
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-pink-700 transition-all shadow-lg"
            >
              HOME
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // MAIN LIST VIEW
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-5">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Track Products</h1>
                <p className="text-gray-600 text-sm">Monitor your product journey through the supply chain</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              HOME
            </button>
          </div>
          <div className="text-xs text-gray-500 font-mono">Account: {currentAccount}</div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Enter Product ID to Track</h2>
          <form onSubmit={handlerSubmit} className="flex gap-3">
            <input
              className="flex-1 px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              type="text"
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter Product ID (e.g., 1, 2, 3...)"
              value={id}
              required
            />
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg"
            >
              Track
            </button>
          </form>
        </div>

        {/* Products table */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Available Products</h2>
            <div className="text-sm text-gray-500">Total: {Object.keys(med).length} items</div>
          </div>

          {Object.keys(med).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products available yet</p>
              <p className="text-gray-400 text-sm mt-2">Add products in the Order Materials page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">ID</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Description</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Stage</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Progress</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.keys(med).map((key) => {
                    const medicineId = parseInt(key)
                    const stage = medStage[medicineId]
                    const stageNum = parseInt(med[medicineId].stage)
                    const progress = getStageProgress(stageNum)
                    return (
                      <tr key={key} className="hover:bg-purple-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">{med[medicineId].id}</td>
                        <td className="px-6 py-4 font-medium text-gray-800">{med[medicineId].name}</td>
                        <td className="px-6 py-4 text-gray-600">{med[medicineId].description}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStageColor(stage)}`}>
                            {stage}
                          </span>
                        </td>
                        {/* NEW: Mini progress bar in table */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => trackMedicine(medicineId)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all text-sm font-semibold"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}