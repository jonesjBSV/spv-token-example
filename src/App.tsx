import React from 'react';
import './App.css';
import AppTabs from './components/AppTabs';


const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <AppTabs />
      </header>
    </div>
  );
};

export default App;
