"use client"

import Link from "next/link"
import { useState } from "react"
import { redeemCode } from "@/lib/redeem"

export default function RedeemPage() {
  const [code, setCode] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [popupTitle, setPopupTitle] = useState("")
  const [popupMessage, setPopupMessage] = useState("")
  const [popupRewards, setPopupRewards] = useState<string[]>([])

  function handleRedeem() {
    const result = redeemCode(code)

    if (result.ok) {
      setPopupTitle("Code Redeemed")
      setPopupMessage(result.message)
      setPopupRewards(result.rewards)
    } else {
      setPopupTitle("Redeem Failed")
      setPopupMessage(result.message)
      setPopupRewards([])
    }

    setShowPopup(true)
    setCode("")
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.15),transparent_22%),linear-gradient(to_bottom,#020617,#000000)] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Redeem</p>
            <h1 className="mt-2 text-4xl font-black">Redeem Code</h1>
            <p className="mt-2 text-slate-300">Enter a code to claim rewards.</p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Main Menu
          </Link>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <label className="mb-3 block text-lg font-bold">Enter Code</label>

          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Type your code"
              className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-slate-500"
            />

            <button
              onClick={handleRedeem}
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 transition hover:scale-[1.02]"
            >
              Redeem
            </button>
          </div>
        </div>
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950 p-6 text-center shadow-2xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Redeem Result</p>
            <h2 className="mt-3 text-3xl font-black">{popupTitle}</h2>
            <p className="mt-4 text-slate-300">{popupMessage}</p>

            {popupRewards.length > 0 && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-300">
                  You received
                </div>
                <div className="space-y-2">
                  {popupRewards.map((reward, index) => (
                    <div key={index} className="rounded-xl bg-black/20 px-3 py-2 text-sm text-white">
                      {reward}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowPopup(false)}
              className="mt-6 w-full rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}