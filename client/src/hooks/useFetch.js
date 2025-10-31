import { useEffect, useState } from "react";
import axios from "axios";

export default function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    axios.get(url).then(r => { if (mounted) setData(r.data); }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
    return () => mounted = false;
  }, [url]);
  return { data, loading };
}
