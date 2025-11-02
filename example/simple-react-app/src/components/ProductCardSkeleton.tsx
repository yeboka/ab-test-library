import { Skeleton } from './Skeleton'

export const ProductCardSkeleton = () => {
  return (
    <div className='max-w-sm w-full rounded-lg overflow-hidden shadow-lg bg-white transition-transform duration-300 flex flex-col'>
      {/* Image skeleton */}
      <Skeleton height={192} width='100%' className='bg-gray-300' />

      <div className='px-6 py-4 flex-1 flex flex-col'>
        {/* Title skeleton */}
        <Skeleton height={28} width='80%' className='mb-2' rounded />

        {/* Price skeleton */}
        <Skeleton height={32} width='40%' className='mb-4' rounded />

        {/* Buttons skeleton */}
        <div className='flex gap-3 mt-auto mb-4'>
          <Skeleton height={36} width='100%' rounded />
          <Skeleton height={36} width='100%' rounded />
        </div>

        {/* Variant label skeleton */}
        <div className='mt-auto pt-2 border-t border-gray-200'>
          <Skeleton height={14} width='60%' className='mx-auto' rounded />
        </div>
      </div>
    </div>
  )
}
