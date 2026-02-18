import { asDate, type Moment as ApiMoment } from '@rin/api'
import { useTranslation } from 'react-i18next'
import { timeago } from '../utils/timeago'
import { Markdown } from './markdown'

export function MomentItem({
  moment,
  onDelete,
  onEdit,
  canManage,
}: {
  moment: ApiMoment
  onDelete: (id: number) => void
  onEdit: (moment: ApiMoment) => void
  canManage: boolean
}) {
  const { t } = useTranslation()
  const createdAtDate = asDate(moment.createdAt, 'moment.createdAt')
  const updatedAtDate = asDate(moment.updatedAt, 'moment.updatedAt')
  const isUpdated = createdAtDate.getTime() !== updatedAtDate.getTime()

  return (
    <div className='bg-w p-4 rounded-lg'>
      <div className='flex justify-between'>
        <div className='flex items-center space-x-3'>
          <img src={moment.user.avatar} alt={moment.user.username} className='w-8 h-8 rounded-full object-cover' />
          <div>
            <p className='t-primary'>{moment.user.username}</p>
            <p className='space-x-2 t-secondary text-sm'>
              <span title={createdAtDate.toLocaleString()}>
                {isUpdated ? t('feed_card.published$time', { time: timeago(createdAtDate) }) : timeago(createdAtDate)}
              </span>
              {isUpdated && (
                <span title={updatedAtDate.toLocaleString()}>
                  {t('feed_card.updated$time', { time: timeago(updatedAtDate) })}
                </span>
              )}
            </p>
          </div>
        </div>
        {canManage && (
          <div>
            <div className='flex gap-2'>
              <button
                type='button'
                aria-label={t('edit')}
                onClick={() => onEdit(moment)}
                className='flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition'
              >
                <i className='ri-edit-2-line dark:text-neutral-400' />
              </button>
              <button
                type='button'
                aria-label={t('delete.title')}
                onClick={() => onDelete(moment.id)}
                className='flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition'
              >
                <i className='ri-delete-bin-7-line text-red-500' />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className='text-black dark:text-white mt-2'>
        <Markdown content={moment.content} />
      </div>
    </div>
  )
}
