import { useCallback, useEffect, useState } from 'react';
import { meRequest, parseMe } from '../../lib/session-api.mjs';

export function useAdminAccount() {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('loading');

  const reload = useCallback(() => {
    return meRequest()
      .then(parseMe)
      .then((session) => {
        setAccount(session);
        setStatus(session ? 'in' : 'out');
        return session;
      })
      .catch(() => {
        setStatus('out');
        return null;
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { account, status, reload };
}
