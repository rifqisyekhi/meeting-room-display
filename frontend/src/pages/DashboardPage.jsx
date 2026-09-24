import { useEffect } from 'react'

export default function DashboardPage() {
  useEffect(() => {
    document.title = 'Dashboard Admin - Booking Ruang Rapat'
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#f4f7fb' }}>
      <iframe
        src="/dashboard-app/index.html"
        title="Dashboard Admin Booking Ruang Rapat"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}
