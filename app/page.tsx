'use client';

import { useEffect } from 'react';
import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import Dashboard from './components/Dashboard';
import NoDateTasks from './components/NoDateTasks';
import ListView from './components/ListView';
import StatusView from './components/StatusView';
import TaskDetailPanel from './components/TaskDetailPanel';
import { useTaskStore } from './store/useTaskStore';

export default function Home() {
  const { error, activeView } = useTaskStore();

  // Set individual mode on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    if (store.mode !== 'individual') {
      store.setIndividualMode();
    }
  }, []);

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
      {activeView === 'gantt' && (
        <>
          <Dashboard />
          <NoDateTasks />
        </>
      )}
      {activeView === 'list' && <ListView />}
      {activeView === 'status' && <StatusView />}
      <TaskDetailPanel />
    </>
  );
}


