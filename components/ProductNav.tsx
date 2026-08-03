import { NavBar } from '@genomicx/ui';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '@/lib/version';

const actions = (
  <>
    <Link to="/app" className="gx-nav-link">Web app</Link>
    <Link to="/download" className="gx-nav-link">Desktop: coming soon</Link>
  </>
);

const mobileActions = (
  <>
    <Link to="/app" className="gx-nav-dropdown-link">Open web app</Link>
    <Link to="/download" className="gx-nav-dropdown-link">Desktop: coming soon</Link>
  </>
);

export default function ProductNav() {
  return (
    <NavBar
      appName="BRIGX"
      appSubtitle="Circular comparative genomics"
      version={APP_VERSION}
      githubUrl="https://github.com/happykhan/brigx"
      actions={actions}
      mobileActions={mobileActions}
    />
  );
}
