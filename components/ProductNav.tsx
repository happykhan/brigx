import { NavBar } from '@genomicx/ui';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '@/lib/version';

const actions = (
  <>
    <Link to="/" className="gx-nav-link">Home</Link>
    <Link to="/app" className="gx-nav-link">Web app</Link>
    <Link to="/download" className="gx-nav-link">Desktop</Link>
  </>
);

const mobileActions = (
  <>
    <Link to="/" className="gx-nav-dropdown-link">Home</Link>
    <Link to="/app" className="gx-nav-dropdown-link">Open web app</Link>
    <Link to="/download" className="gx-nav-dropdown-link">Desktop</Link>
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
