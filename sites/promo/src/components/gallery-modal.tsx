'use client'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { Container } from './container'

const files: Array<{
  url: string
  name: string
  description: string
  column?: number
}> = [
  {
    url: '/gallery/store.png',
    name: 'Store',
    description:
      'A store page with ~20 games imported and slightly customised metadata.',
  },
  {
    url: '/gallery/storepage.png',
    name: 'Store page - Enshrouded',
    description: 'An example store page of Enshrouded.',
  },
  {
    url: '/gallery/storepagemobile.png',
    name: 'Mobile store page - Enshrouded',
    description: 'A mobile view of the example store page of Enshrouded',
  },
  {
    url: '/gallery/developermobile.png',
    name: 'Company page - Keen Games',
    description:
      'An example company page that lists their games. Can be filtered by developed or published.',
  },
  {
    url: '/gallery/devices.png',
    name: 'Devices page',
    description: 'A list of authorised devices connected to your account.',
  },
  {
    url: '/gallery/companyadmin.png',
    name: 'Company - Admin Dashboard',
    description:
      'Page to edit and customise company metadata, and add/remove games to it.',
  },
  {
    url: '/gallery/importgameadmin.png',
    name: 'Import game - Admin Dashboard',
    description:
      'Importing a game with metadata from configured metadata providers.',
    column: 0,
  },
  {
    url: '/gallery/importversionadmin.png',
    name: 'Import version - Admin Dashboard',
    description:
      'Importing an example version, with the auto-suggested executable name.',
    column: 1,
  },
]

export function Gallery() {
  const [currentModal, setCurrentModal] = useState<string | undefined>()
  function resetModal() {
    setCurrentModal(undefined)
  }

  return (
    <Container className="py-10">
      <div
        role="list"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-4"
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex flex-col gap-y-4">
            {files
              .filter((v, i) =>
                v.column !== undefined ? index == v.column : i % 4 == index,
              )
              .map((file) => (
                <div key={file.url} className="relative w-full">
                  <div className="group overflow-hidden rounded-lg bg-gray-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600">
                    <img
                      alt=""
                      src={file.url}
                      className="pointer-events-none aspect-10/7 aspect-auto rounded-lg object-cover outline -outline-offset-1 outline-black/5 group-hover:opacity-75"
                    />
                    <button
                      type="button"
                      className="absolute inset-0 focus:outline-hidden"
                      onClick={() => setCurrentModal(file.url)}
                    >
                      <span className="sr-only">
                        View details for {file.name}
                      </span>
                    </button>
                  </div>
                  <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="pointer-events-none block text-xs font-medium text-gray-500">
                    {file.description}
                  </p>
                </div>
              ))}
          </div>
        ))}
      </div>
      <GalleryModal img={currentModal} close={resetModal} />
    </Container>
  )
}

export default function GalleryModal({
  img,
  close,
}: {
  img?: string
  close: () => void
}) {
  return (
    <Dialog open={!!img} onClose={close} className="relative z-10">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 z-10 h-screen w-screen">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative m-8 transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <img src={img} alt="" className="max-h-[90vh] w-full" />
            <button
              className="absolute top-0 right-0 m-4 cursor-pointer rounded-xl bg-zinc-900 p-2 text-zinc-100 outline outline-zinc-700 hover:text-zinc-400"
              onClick={close}
            >
              <XMarkIcon className="size-4" />
            </button>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
