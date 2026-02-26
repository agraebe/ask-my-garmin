import ChatInterface from '@/components/ChatInterface';
import GarminStatus from '@/components/GarminStatus';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-garmin-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm select-none">G</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Ask My Garmin</h1>
          </div>
          <GarminStatus />
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full mx-auto overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        <ChatInterface />
      </div>
    </main>
  );
}
