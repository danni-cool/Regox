import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark')
  )

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
