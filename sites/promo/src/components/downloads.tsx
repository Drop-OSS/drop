'use client'

import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/16/solid'
import Link from 'next/link'
import { useState, type JSX } from 'react'
import { Button } from './button'
import { Container } from './container'
import { Heading } from './text'

type Version = 'v0.2.0' | 'v0.3.0' | 'v0.3.1' | 'v0.3.2' | 'v0.3.3' | 'v0.3.4'
type Platforms = 'Windows' | 'Linux' | 'macOS'
type Arch = 'x86' | 'ARM'

const releasePages: { [key in Version]: string } = {
  'v0.2.0': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.2.0-beta',
  'v0.3.0': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.3.0',
  'v0.3.1': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.3.1',
  'v0.3.2': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.3.2',
  'v0.3.3': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.3.3',
  'v0.3.4': 'https://github.com/Drop-OSS/drop-app/releases/tag/v0.3.4',
}

function WindowsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      className="size-12"
    >
      <g
        id="Page-1"
        stroke="none"
        strokeWidth="1"
        fill="none"
        fillRule="evenodd"
      >
        <g
          id="Dribbble-Light-Preview"
          transform="translate(-60.000000, -7439.000000)"
          fill="currentColor"
        >
          <g id="icons" transform="translate(56.000000, 160.000000)">
            <path
              d="M13.1458647,7289.43426 C13.1508772,7291.43316 13.1568922,7294.82929 13.1619048,7297.46884 C16.7759398,7297.95757 20.3899749,7298.4613 23.997995,7299 C23.997995,7295.84873 24.002005,7292.71146 23.997995,7289.71311 C20.3809524,7289.71311 16.7649123,7289.43426 13.1458647,7289.43426 M4,7289.43526 L4,7296.22153 C6.72581454,7296.58933 9.45162907,7296.94113 12.1724311,7297.34291 C12.1774436,7294.71736 12.1704261,7292.0908 12.1704261,7289.46524 C9.44661654,7289.47024 6.72380952,7289.42627 4,7289.43526 M4,7281.84344 L4,7288.61071 C6.72581454,7288.61771 9.45162907,7288.57673 12.1774436,7288.57973 C12.1754386,7285.96017 12.1754386,7283.34361 12.1724311,7280.72405 C9.44461153,7281.06486 6.71679198,7281.42567 4,7281.84344 M24,7288.47179 C20.3879699,7288.48578 16.7759398,7288.54075 13.1619048,7288.55175 C13.1598997,7285.88921 13.1598997,7283.22967 13.1619048,7280.56914 C16.7689223,7280.01844 20.3839599,7279.50072 23.997995,7279 C24,7282.15826 23.997995,7285.31353 24,7288.47179"
              id="windows-[#174]"
            ></path>
          </g>
        </g>
      </g>
    </svg>
  )
}

function LinuxIcon() {
  return (
    <svg
      fill="currentColor"
      version="1.1"
      id="Layer_1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 304.998 304.998"
      className="size-12"
    >
      <g id="XMLID_91_">
        <path
          id="XMLID_92_"
          d="M274.659,244.888c-8.944-3.663-12.77-8.524-12.4-15.777c0.381-8.466-4.422-14.667-6.703-17.117   c1.378-5.264,5.405-23.474,0.004-39.291c-5.804-16.93-23.524-42.787-41.808-68.204c-7.485-10.438-7.839-21.784-8.248-34.922   c-0.392-12.531-0.834-26.735-7.822-42.525C190.084,9.859,174.838,0,155.851,0c-11.295,0-22.889,3.53-31.811,9.684   c-18.27,12.609-15.855,40.1-14.257,58.291c0.219,2.491,0.425,4.844,0.545,6.853c1.064,17.816,0.096,27.206-1.17,30.06   c-0.819,1.865-4.851,7.173-9.118,12.793c-4.413,5.812-9.416,12.4-13.517,18.539c-4.893,7.387-8.843,18.678-12.663,29.597   c-2.795,7.99-5.435,15.537-8.005,20.047c-4.871,8.676-3.659,16.766-2.647,20.505c-1.844,1.281-4.508,3.803-6.757,8.557   c-2.718,5.8-8.233,8.917-19.701,11.122c-5.27,1.078-8.904,3.294-10.804,6.586c-2.765,4.791-1.259,10.811,0.115,14.925   c2.03,6.048,0.765,9.876-1.535,16.826c-0.53,1.604-1.131,3.42-1.74,5.423c-0.959,3.161-0.613,6.035,1.026,8.542   c4.331,6.621,16.969,8.956,29.979,10.492c7.768,0.922,16.27,4.029,24.493,7.035c8.057,2.944,16.388,5.989,23.961,6.913   c1.151,0.145,2.291,0.218,3.39,0.218c11.434,0,16.6-7.587,18.238-10.704c4.107-0.838,18.272-3.522,32.871-3.882   c14.576-0.416,28.679,2.462,32.674,3.357c1.256,2.404,4.567,7.895,9.845,10.724c2.901,1.586,6.938,2.495,11.073,2.495   c0.001,0,0,0,0.001,0c4.416,0,12.817-1.044,19.466-8.039c6.632-7.028,23.202-16,35.302-22.551c2.7-1.462,5.226-2.83,7.441-4.065   c6.797-3.768,10.506-9.152,10.175-14.771C282.445,250.905,279.356,246.811,274.659,244.888z M124.189,243.535   c-0.846-5.96-8.513-11.871-17.392-18.715c-7.26-5.597-15.489-11.94-17.756-17.312c-4.685-11.082-0.992-30.568,5.447-40.602   c3.182-5.024,5.781-12.643,8.295-20.011c2.714-7.956,5.521-16.182,8.66-19.783c4.971-5.622,9.565-16.561,10.379-25.182   c4.655,4.444,11.876,10.083,18.547,10.083c1.027,0,2.024-0.134,2.977-0.403c4.564-1.318,11.277-5.197,17.769-8.947   c5.597-3.234,12.499-7.222,15.096-7.585c4.453,6.394,30.328,63.655,32.972,82.044c2.092,14.55-0.118,26.578-1.229,31.289   c-0.894-0.122-1.96-0.221-3.08-0.221c-7.207,0-9.115,3.934-9.612,6.283c-1.278,6.103-1.413,25.618-1.427,30.003   c-2.606,3.311-15.785,18.903-34.706,21.706c-7.707,1.12-14.904,1.688-21.39,1.688c-5.544,0-9.082-0.428-10.551-0.651l-9.508-10.879   C121.429,254.489,125.177,250.583,124.189,243.535z M136.254,64.149c-0.297,0.128-0.589,0.265-0.876,0.411   c-0.029-0.644-0.096-1.297-0.199-1.952c-1.038-5.975-5-10.312-9.419-10.312c-0.327,0-0.656,0.025-1.017,0.08   c-2.629,0.438-4.691,2.413-5.821,5.213c0.991-6.144,4.472-10.693,8.602-10.693c4.85,0,8.947,6.536,8.947,14.272   C136.471,62.143,136.4,63.113,136.254,64.149z M173.94,68.756c0.444-1.414,0.684-2.944,0.684-4.532   c0-7.014-4.45-12.509-10.131-12.509c-5.552,0-10.069,5.611-10.069,12.509c0,0.47,0.023,0.941,0.067,1.411   c-0.294-0.113-0.581-0.223-0.861-0.329c-0.639-1.935-0.962-3.954-0.962-6.015c0-8.387,5.36-15.211,11.95-15.211   c6.589,0,11.95,6.824,11.95,15.211C176.568,62.78,175.605,66.11,173.94,68.756z M169.081,85.08   c-0.095,0.424-0.297,0.612-2.531,1.774c-1.128,0.587-2.532,1.318-4.289,2.388l-1.174,0.711c-4.718,2.86-15.765,9.559-18.764,9.952   c-2.037,0.274-3.297-0.516-6.13-2.441c-0.639-0.435-1.319-0.897-2.044-1.362c-5.107-3.351-8.392-7.042-8.763-8.485   c1.665-1.287,5.792-4.508,7.905-6.415c4.289-3.988,8.605-6.668,10.741-6.668c0.113,0,0.215,0.008,0.321,0.028   c2.51,0.443,8.701,2.914,13.223,4.718c2.09,0.834,3.895,1.554,5.165,2.01C166.742,82.664,168.828,84.422,169.081,85.08z    M205.028,271.45c2.257-10.181,4.857-24.031,4.436-32.196c-0.097-1.855-0.261-3.874-0.42-5.826   c-0.297-3.65-0.738-9.075-0.283-10.684c0.09-0.042,0.19-0.078,0.301-0.109c0.019,4.668,1.033,13.979,8.479,17.226   c2.219,0.968,4.755,1.458,7.537,1.458c7.459,0,15.735-3.659,19.125-7.049c1.996-1.996,3.675-4.438,4.851-6.372   c0.257,0.753,0.415,1.737,0.332,3.005c-0.443,6.885,2.903,16.019,9.271,19.385l0.927,0.487c2.268,1.19,8.292,4.353,8.389,5.853   c-0.001,0.001-0.051,0.177-0.387,0.489c-1.509,1.379-6.82,4.091-11.956,6.714c-9.111,4.652-19.438,9.925-24.076,14.803   c-6.53,6.872-13.916,11.488-18.376,11.488c-0.537,0-1.026-0.068-1.461-0.206C206.873,288.406,202.886,281.417,205.028,271.45z    M39.917,245.477c-0.494-2.312-0.884-4.137-0.465-5.905c0.304-1.31,6.771-2.714,9.533-3.313c3.883-0.843,7.899-1.714,10.525-3.308   c3.551-2.151,5.474-6.118,7.17-9.618c1.228-2.531,2.496-5.148,4.005-6.007c0.085-0.05,0.215-0.108,0.463-0.108   c2.827,0,8.759,5.943,12.177,11.262c0.867,1.341,2.473,4.028,4.331,7.139c5.557,9.298,13.166,22.033,17.14,26.301   c3.581,3.837,9.378,11.214,7.952,17.541c-1.044,4.909-6.602,8.901-7.913,9.784c-0.476,0.108-1.065,0.163-1.758,0.163   c-7.606,0-22.662-6.328-30.751-9.728l-1.197-0.503c-4.517-1.894-11.891-3.087-19.022-4.241c-5.674-0.919-13.444-2.176-14.732-3.312   c-1.044-1.171,0.167-4.978,1.235-8.337c0.769-2.414,1.563-4.91,1.998-7.523C41.225,251.596,40.499,248.203,39.917,245.477z"
        />
      </g>
    </svg>
  )
}

function macOSIcon() {
  return (
    <svg
      viewBox="-1.5 0 20 20"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      className="size-14"
    >
      <g
        id="Page-1"
        stroke="none"
        strokeWidth="1"
        fill="none"
        fillRule="evenodd"
      >
        <g
          id="Dribbble-Light-Preview"
          transform="translate(-102.000000, -7439.000000)"
          fill="currentColor"
        >
          <g id="icons" transform="translate(56.000000, 160.000000)">
            <path
              d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485"
              id="apple-[#173]"
            ></path>
          </g>
        </g>
      </g>
    </svg>
  )
}

const downloads: {
  [key in Platforms]: {
    name: string
    description: string
    icon: () => JSX.Element
    downloads: { [key in Version]: { [key in Arch]: string | undefined } }
  }
} = {
  Windows: {
    name: 'Windows',
    description:
      'A setup executable to install the Drop Desktop Client on your Windows system.',
    icon: WindowsIcon,
    downloads: {
      'v0.2.0': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.2.0-beta/Drop.Desktop.Client_0.2.0-beta_x64-setup.exe',
        ARM: undefined,
      },
      'v0.3.0': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.0/Drop.Desktop.Client_0.3.0_x64-setup.exe',
        ARM: undefined,
      },
      'v0.3.1': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.1/Drop.Desktop.Client_0.3.1_x64-setup.exe',
        ARM: undefined,
      },
      'v0.3.2': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.2/Drop.Desktop.Client_0.3.2_x64-setup.exe',
        ARM: undefined,
      },
      'v0.3.3': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.3/Drop.Desktop.Client_0.3.3_x64-setup.exe',
        ARM: undefined,
      },
      'v0.3.4': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.4/Drop.Desktop.Client_0.3.4_x64-setup.exe',
        ARM: undefined,
      },
    },
  },
  Linux: {
    name: 'Linux',
    description:
      'A .deb file that can be installed on Debian-based systems, or repackaged to another distro. Other Linux downloads are available on the GitHub releases page.',
    icon: LinuxIcon,
    downloads: {
      'v0.2.0': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.2.0-beta/Drop.Desktop.Client_0.2.0-beta_amd64.deb',
        ARM: undefined,
      },
      'v0.3.0': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.0/Drop.Desktop.Client_0.3.0_amd64.deb',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.0/Drop.Desktop.Client_0.3.0_arm64.deb',
      },
      'v0.3.1': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.1/Drop.Desktop.Client_0.3.1_amd64.deb',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.1/Drop.Desktop.Client_0.3.1_arm64.deb',
      },
      'v0.3.2': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.2/Drop.Desktop.Client_0.3.2_amd64.deb',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.2/Drop.Desktop.Client_0.3.2_arm64.deb',
      },
      'v0.3.3': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.3/Drop.Desktop.Client_0.3.3_amd64.deb',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.3/Drop.Desktop.Client_0.3.3_arm64.deb',
      },
      'v0.3.4': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.4/Drop.Desktop.Client_0.3.4_amd64.deb',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.4/Drop.Desktop.Client_0.3.4_arm64.deb',
      },
    },
  },
  macOS: {
    name: 'macOS',
    description: 'A self-signed .dmg to install on your macOS system.',
    icon: macOSIcon,
    downloads: {
      'v0.2.0': {
        x86: undefined,
        ARM: undefined,
      },
      'v0.3.0': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.0/Drop.Desktop.Client_0.3.0_x64.dmg',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.0/Drop.Desktop.Client_0.3.0_aarch64.dmg',
      },
      'v0.3.1': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.1/Drop.Desktop.Client_0.3.1_x64.dmg',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.1/Drop.Desktop.Client_0.3.1_aarch64.dmg',
      },
      'v0.3.2': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.2/Drop.Desktop.Client_0.3.2_x64.dmg',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.2/Drop.Desktop.Client_0.3.2_aarch64.dmg',
      },
      'v0.3.3': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.3/Drop.Desktop.Client_0.3.3_x64.dmg',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.3/Drop.Desktop.Client_0.3.3_aarch64.dmg',
      },
      'v0.3.4': {
        x86: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.4/Drop.Desktop.Client_0.3.4_x64.dmg',
        ARM: 'https://github.com/Drop-OSS/drop-app/releases/download/v0.3.4/Drop.Desktop.Client_0.3.4_aarch64.dmg',
      },
    },
  },
}

function DownloadCard({
  version,
  data,
}: {
  version: Version
  data: (typeof downloads)[Platforms]
}) {
  return (
    <div className="-m-2 grid grid-cols-1 rounded-4xl shadow-[inset_0_0_2px_1px_#ffffff4d] ring-1 ring-black/5 max-lg:mx-auto max-lg:w-full max-lg:max-w-md">
      <div className="grid grid-cols-1 rounded-4xl p-2 shadow-md shadow-black/5">
        <div className="flex h-full flex-col justify-between rounded-3xl bg-zinc-900/50 p-10 pb-9 shadow-2xl ring-1 ring-white/5">
          <div>
            <div className="flex w-full items-center justify-center gap-x-4">
              {data.icon()}
              <Heading>{data.name}</Heading>
            </div>

            <p className="mt-3 text-sm/6 text-zinc-100/75">
              {data.description}
            </p>
          </div>
          <div className="mt-8 flex w-full items-center justify-center gap-x-3">
            {Object.entries(data.downloads[version])
              .filter(([, link]) => link)
              .map(([arch, link]) => (
                <Button key={arch} href={link} variant="outline">
                  Download {arch} &rarr;
                </Button>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DownloadCards() {
  const [currentVersion, setCurrentVersion] = useState<Version>(
    Object.keys(releasePages).at(-1)! as Version,
  )

  return (
    <div className="relative py-24">
      <pre className="hidden" id="download-matrix">
        {JSON.stringify(downloads)}
      </pre>

      <Container>
        <div className="flex flex-col items-center">
          <Listbox value={currentVersion} onChange={setCurrentVersion}>
            <Label className="block text-sm/6 font-medium text-zinc-100">
              Version
            </Label>
            <div className="relative mt-2">
              <ListboxButton className="grid w-full min-w-[10rem] cursor-default grid-cols-1 rounded-md bg-zinc-900 py-1.5 pr-2 pl-3 text-left text-zinc-100 outline-1 -outline-offset-1 outline-zinc-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:text-sm/6">
                <span className="col-start-1 row-start-1 truncate pr-6">
                  {currentVersion}
                </span>
                <ChevronUpDownIcon
                  aria-hidden="true"
                  className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4"
                />
              </ListboxButton>

              <ListboxOptions
                transition
                className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg outline-1 outline-white/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm"
              >
                {Object.keys(releasePages).map((version) => (
                  <ListboxOption
                    key={version}
                    value={version}
                    className="group relative cursor-default py-2 pr-9 pl-3 text-zinc-100 select-none data-focus:bg-blue-600 data-focus:text-white data-focus:outline-hidden"
                  >
                    <span className="block truncate font-normal group-data-selected:font-semibold">
                      {version}
                    </span>

                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 group-not-data-selected:hidden group-data-focus:text-white">
                      <CheckIcon aria-hidden="true" className="size-5" />
                    </span>
                  </ListboxOption>
                ))}
              </ListboxOptions>
            </div>
          </Listbox>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {Object.entries(downloads).map(([platform, data]) => (
            <DownloadCard key={platform} data={data} version={currentVersion} />
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Link
            href={releasePages[currentVersion]}
            className="text-xs font-semibold text-gray-500 hover:text-gray-600 hover:underline"
          >
            Open GitHub releases page &rarr;
          </Link>
        </div>
      </Container>
    </div>
  )
}
