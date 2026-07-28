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
  return (
    <div
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
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <Screen />
        <GuestPreviewBar />
      </div>
      <BottomNav />
      <WeatherPanel />
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
