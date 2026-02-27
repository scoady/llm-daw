import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: React.ReactNode
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] h-[90vh]',
}

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-[0.97]" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.97]"
          >
            <Dialog.Panel
              className={clsx(
                'w-full flex flex-col overflow-hidden rounded-lg',
                'bg-surface-1/95 backdrop-blur-xl',
                'border border-border-default',
                'shadow-panel-raised',
                SIZE_CLASSES[size]
              )}
            >
              {/* Top accent gradient line */}
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

              {title && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                  <Dialog.Title className="text-sm font-semibold text-text-primary tracking-tight">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-3"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
