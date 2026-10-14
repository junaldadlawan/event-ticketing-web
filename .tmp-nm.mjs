import fs from 'fs';
const p='src/components/Layout.tsx';let s=fs.readFileSync(p,'utf8');
const m=(a,b)=>{if(!s.includes(a))throw new Error('missing '+a.slice(0,70));s=s.replace(a,b);};
m("  const managementHidden = useManagementHidden();\n","  // Management tabs are for people who run events (or admins): a plain customer never sees them. While that is\n  // still being checked (isHost === null) they stay hidden too.\n  const hideManagement = useManagementHidden() || isHost !== true;\n");
m("    if (managementHidden && /^\/(manage|admin)(\/|$)/.test(pathname)) navigate('/', { replace: true });\n  }, [managementHidden, pathname, navigate]);","    // A customer (or a host browsing as one) who lands on a management address is sent to the home page.\n    if (isHost === false || (isHost === true && hideManagement)) {\n      if (/^\/(manage|admin)(\/|$)/.test(pathname)) navigate('/', { replace: true });\n    }\n  }, [isHost, hideManagement, pathname, navigate]);");
m("          {user && !managementHidden && (","          {user && !hideManagement && (");
m("{!managementHidden && <Link to=\"/manage\">Manage</Link>}","{!hideManagement && <Link to=\"/manage\">Manage</Link>}");
fs.writeFileSync(p,s);
