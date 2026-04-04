import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
import EstimatesDashboard from './EstimatesDashboard';
import EnvelopeEstimator from './EnvelopeEstimator';
import './index.css';

function App() {
  return (
    <AuthGate appTitle="Envelope Estimator">
      {({ session, user, signOut }) => (
        <AppRouter session={session} user={user} signOut={signOut} />
      )}
    </AuthGate>
  );
}

function AppRouter({ session, user, signOut }) {
  const [view, setView] = useState("dashboard");
  const [draftData, setDraftData] = useState(null);

  if (view === "estimator") {
    return (
      <EnvelopeEstimator
        user={user}
        session={session}
        onSignOut={signOut}
        onBackToDashboard={() => { setDraftData(null); setView("dashboard"); }}
        initialData={draftData}
      />
    );
  }

  return (
    <EstimatesDashboard
      user={user}
      onNewEstimate={(draft) => { setDraftData(draft || null); setView("estimator"); }}
      onSignOut={signOut}
      appSource="envelope"
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
