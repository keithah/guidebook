import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { colors, fonts } from './theme.js';
import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Home from './components/screens/Home.jsx';
import Wifi from './components/screens/Wifi.jsx';
import Arrive from './components/screens/Arrive.jsx';
import Cottage from './components/screens/Cottage.jsx';
import AroundMain from './components/screens/AroundMain.jsx';
import Nearby from './components/screens/Nearby.jsx';
import HowToRide from './components/screens/HowToRide.jsx';
import Explore from './components/screens/Explore.jsx';
import Help from './components/screens/Help.jsx';
import GuestPreviewBar from './components/GuestPreviewBar.jsx';
import WeatherPanel from './components/WeatherPanel.jsx';

function Screen() {
  const { tab, sub } = useApp();
  if (tab === 'home') return <Home />;
  if (tab === 'wifi') return <Wifi />;
  if (tab === 'arrive') return <Arrive />;
  if (tab === 'cottage') return <Cottage />;
  if (tab === 'around') {
    if (sub === 'nearby') return <Nearby />;
    if (sub === 'ride') return <HowToRide />;
    return <AroundMain />;
  }
  if (tab === 'explore') return <Explore />;
  if (tab === 'help') return <Help />;
  return null;
}

function Shell() {
  const { scrollRef } = useApp();
  const [showTop, setShowTop] = useState(false);
  return (
    <div
      className="app-shell"
      style={{
        maxWidth: 430,
        margin: '0 auto',
        height: '100vh',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.sans,
        color: colors.ink,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 0 60px rgba(20,32,29,.18)',
      }}
    >
      <TopBar />
      <div
        ref={scrollRef}
        className="app-scroll"
        onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 400)}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        <Screen />
        <div className="print-hide">
          <GuestPreviewBar />
        </div>
      </div>
      {showTop && (
        <div
          className="print-hide"
          onClick={() => scrollRef.current && scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{
            position: 'absolute',
            right: 14,
            bottom: 78,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: colors.ink,
            color: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(20,32,29,.3)',
            zIndex: 30,
          }}
        >
          ↑
        </div>
      )}
      <div className="print-hide">
        <BottomNav />
        <WeatherPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
