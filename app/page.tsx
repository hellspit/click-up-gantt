'use client';

import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import Dashboard from './components/Dashboard';
import NoDateTasks from './components/NoDateTasks';
import { useTaskStore } from './store/useTaskStore';

export default function Home() {
  const { error } = useTaskStore();

  return (
    <>
      <Header />
      <SummaryBar />
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => useTaskStore.getState().reset()}>Dismiss</button>
        </div>
      )}
      <Dashboard />
      <NoDateTasks />
    </>
  );
}
