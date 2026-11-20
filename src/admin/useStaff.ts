import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import type { Staff } from '../lib/types'

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([])
  const load = useCallback(async () => {
    const { data } = await db().from('staff').select('*').order('sort_order')
    setStaff((data as Staff[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])
  return { staff, reload: load }
}
