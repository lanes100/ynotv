interface NavigationTabProps {
  navHiddenTabs: string[];
  onNavHiddenTabsChange: (tabs: string[]) => void;
}

const NAV_ITEMS = [
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'dvr', label: 'DVR' },
  { id: 'sports', label: 'Sports' },
  { id: 'stremio', label: 'Strem' },
];

export function NavigationTab({ navHiddenTabs, onNavHiddenTabsChange }: NavigationTabProps) {
  const isVisible = (id: string) => !navHiddenTabs.includes(id);

  const handleToggle = (id: string, checked: boolean) => {
    if (checked) {
      // Show — remove from hidden list
      onNavHiddenTabsChange(navHiddenTabs.filter((t) => t !== id));
    } else {
      // Hide — add to hidden list
      onNavHiddenTabsChange([...navHiddenTabs, id]);
    }
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-section" style={{ paddingBottom: '8px' }}>
        <div className="section-header">
          <h3>Titlebar Navigation</h3>
        </div>

        <p className="section-description" style={{ marginBottom: '12px' }}>
          Show or hide navigation buttons in the titlebar.
        </p>

        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
                {item.label}
              </div>
            </div>
            <input
              type="checkbox"
              checked={isVisible(item.id)}
              onChange={(e) => handleToggle(item.id, e.target.checked)}
              style={{ cursor: 'pointer', marginLeft: '1rem' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
