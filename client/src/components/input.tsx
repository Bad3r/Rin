import { forwardRef, useEffect, useRef } from 'react'

interface InputProps {
  autofocus?: boolean
  value: string
  className?: string
  placeholder: string
  id?: string | number
  setValue: (v: string) => void
  onSubmit?: () => void
  disabled?: boolean
  type?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ autofocus, value, setValue, className, placeholder, id, onSubmit, disabled, type = 'text' }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      if (autofocus) {
        innerRef.current?.focus()
      }
    }, [autofocus])

    return (
      <input
        id={id?.toString()}
        ref={node => {
          innerRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onKeyDown={event => {
          if (event.key === 'Enter' && onSubmit) {
            onSubmit()
          }
        }}
        onChange={event => {
          setValue(event.target.value)
        }}
        className={
          'focus-visible:outline-none bg-secondary focus-visible:outline-theme w-full py-2 px-4 rounded-xl bg-w t-primary disabled:opacity-50 disabled:cursor-not-allowed ' +
          className
        }
      />
    )
  }
)
export function Checkbox({
  value,
  setValue,
  className,
  placeholder,
}: {
  value: boolean
  className?: string
  placeholder: string
  id: string
  setValue: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    <input
      type='checkbox'
      placeholder={placeholder}
      checked={value}
      onChange={event => {
        setValue(event.target.checked)
      }}
      className={className}
    />
  )
}
