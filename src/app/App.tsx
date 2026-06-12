import { Routes, Route } from 'react-router-dom';
import { Header, ViewTabs, Footer } from '@app/layouts';
import { Navigator, Pathway, Conflicts, WhatIf, Decoder, LogicDemo, DecisionCanvas, LiveSession, LiveIntent } from '@/views';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Routes>
        {/* Decision Canvas: Default full-screen single-canvas layout */}
        <Route path="/" element={<DecisionCanvas />} />

        {/* Live trading: intent-creation form */}
        <Route path="/live" element={<LiveIntent />} />
        {/* Live trading session */}
        <Route path="/live/:intentId" element={<LiveSession />} />

        {/* Legacy tab-based layout */}
        <Route
          path="/legacy/*"
          element={
            <div className="mx-auto max-w-7xl p-6">
              <Header />
              <ViewTabs />
              <main className="py-6">
                <Routes>
                  <Route path="/" element={<Navigator />} />
                  <Route path="/pathway" element={<Pathway />} />
                  <Route path="/conflicts" element={<Conflicts />} />
                  <Route path="/whatif" element={<WhatIf />} />
                  <Route path="/decoder" element={<Decoder />} />
                  <Route path="/logic" element={<LogicDemo />} />
                </Routes>
              </main>
              <Footer />
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
