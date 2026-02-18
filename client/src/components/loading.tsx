import type { ReactNode } from 'react'
import ReactLoading from './react-loading'

type WaitCondition = boolean | string | number | object | null | undefined

export function Waiting({ for: wait, children }: { for?: WaitCondition; children?: ReactNode }) {
  return (
    <>
      {!wait ? (
        <div className='w-full h-96 flex flex-col justify-center items-center mb-8 ani-show-fast'>
          <ReactLoading type='cylon' color='#FC466B' />
        </div>
      ) : (
        children
      )}
    </>
  )
}
