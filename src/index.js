import React from 'react'

import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

const defaultEstimateSize = () => 50

const defaultKeyExtractor = index => index

export const defaultRangeExtractor = range => {
  const start = Math.max(range.start - range.overscan, 0)
  const end = Math.min(range.end + range.overscan, range.size - 1)

  const arr = []

  for (let i = start; i <= end; i++) {
    arr.push(i)
  }

  return arr
}

export function useVirtual({
  size = 0,
  estimateSize = defaultEstimateSize,
  overscan = 1,
  paddingStart = 0,
  paddingEnd = 0,
  parentRef,
  parentDimensions,
  horizontal,
  scrollToFn,
  scrollOffsetFn,
  keyExtractor = defaultKeyExtractor,
  rangeExtractor = defaultRangeExtractor,
}) {
  const sizeKey = horizontal ? 'width' : 'height'
  const scrollKey = horizontal ? 'x' : 'y'
  const latestRef = React.useRef({
    scrollOffset: 0,
    measurements: [],
  })

  const [onLayoutDimensions, setOnLayoutDimensions] = React.useState(null)
  const onLayout = React.useCallback(({ nativeEvent }) => {
    setOnLayoutDimensions(nativeEvent.layout)
  }, [])

  const resolvedParentDimensions = parentDimensions || onLayoutDimensions

  const { [sizeKey]: outerSize } = resolvedParentDimensions || {
    [sizeKey]: 0,
  }
  latestRef.current.outerSize = outerSize

  const defaultScrollToFn = React.useCallback(
    offset => {
      if (parentRef?.current) {
        parentRef.current.scrollTo({ [scrollKey]: offset })
      }
    },
    [parentRef, scrollKey]
  )

  const resolvedScrollToFn = scrollToFn || defaultScrollToFn

  scrollToFn = React.useCallback(
    offset => {
      resolvedScrollToFn(offset, defaultScrollToFn)
    },
    [defaultScrollToFn, resolvedScrollToFn]
  )

  const [measuredCache, setMeasuredCache] = React.useState({})

  const measure = React.useCallback(() => setMeasuredCache({}), [])

  const pendingMeasuredCacheIndexesRef = React.useRef([])

  const measurements = React.useMemo(() => {
    const min =
      pendingMeasuredCacheIndexesRef.current.length > 0
        ? Math.min(...pendingMeasuredCacheIndexesRef.current)
        : 0
    pendingMeasuredCacheIndexesRef.current = []

    const measurements = latestRef.current.measurements.slice(0, min)

    for (let i = min; i < size; i++) {
      const key = keyExtractor(i)
      const measuredSize = measuredCache[key]
      const start = measurements[i - 1] ? measurements[i - 1].end : paddingStart
      const size =
        typeof measuredSize === 'number' ? measuredSize : estimateSize(i)
      const end = start + size
      measurements[i] = { index: i, start, size, end, key }
    }
    return measurements
  }, [estimateSize, measuredCache, paddingStart, size, keyExtractor])

  const totalSize = (measurements[size - 1]?.end || 0) + paddingEnd

  latestRef.current.measurements = measurements
  latestRef.current.totalSize = totalSize

  const [range, setRange] = React.useState({ start: 0, end: 0 })

  const scrollOffsetFnRef = React.useRef(scrollOffsetFn)
  scrollOffsetFnRef.current = scrollOffsetFn

  const rangeTimeoutIdRef = React.useRef(null)

  const cancelAsyncRange = React.useCallback(() => {
    if (rangeTimeoutIdRef.current !== null) {
      clearTimeout(rangeTimeoutIdRef.current)
      rangeTimeoutIdRef.current = null
    }
  }, [])

  useIsomorphicLayoutEffect(() => {
    rangeTimeoutIdRef.current = setTimeout(() => {
      setRange(prevRange => calculateRange(latestRef.current, prevRange))
    })
    return () => cancelAsyncRange()
  }, [measurements, outerSize, cancelAsyncRange])

  const onScroll = React.useCallback(
    ({ nativeEvent }) => {
      const scrollOffset = nativeEvent.contentOffset[scrollKey]

      latestRef.current.scrollOffset = scrollOffset

      cancelAsyncRange()
      setRange(prevRange => calculateRange(latestRef.current, prevRange))
    },
    [cancelAsyncRange, scrollKey]
  )

  const virtualItems = React.useMemo(() => {
    const indexes = rangeExtractor({
      start: range.start,
      end: range.end,
      overscan,
      size: measurements.length,
    })

    const virtualItems = []

    for (let k = 0, len = indexes.length; k < len; k++) {
      const i = indexes[k]
      const measurement = measurements[i]

      const item = {
        ...measurement,
        measureOnLayout: ({ nativeEvent }) => {
          const measuredSize = nativeEvent.layout[sizeKey]

          if (measuredSize !== item.size) {
            const { scrollOffset } = latestRef.current

            if (item.start < scrollOffset) {
              defaultScrollToFn(scrollOffset + (measuredSize - item.size))
            }

            pendingMeasuredCacheIndexesRef.current.push(i)

            setMeasuredCache(old => ({
              ...old,
              [item.key]: measuredSize,
            }))
          }
        },
      }

      virtualItems.push(item)
    }

    return virtualItems
  }, [
    defaultScrollToFn,
    measurements,
    overscan,
    range.end,
    range.start,
    rangeExtractor,
    sizeKey,
  ])

  const mountedRef = React.useRef()

  useIsomorphicLayoutEffect(() => {
    if (mountedRef.current) {
      if (estimateSize) setMeasuredCache({})
    }
    mountedRef.current = true
  }, [estimateSize])

  const scrollToOffset = React.useCallback(
    (toOffset, { align = 'start' } = {}) => {
      const { scrollOffset, outerSize } = latestRef.current

      if (align === 'auto') {
        if (toOffset <= scrollOffset) {
          align = 'start'
        } else if (toOffset >= scrollOffset + outerSize) {
          align = 'end'
        } else {
          align = 'start'
        }
      }

      if (align === 'start') {
        scrollToFn(toOffset)
      } else if (align === 'end') {
        scrollToFn(toOffset - outerSize)
      } else if (align === 'center') {
        scrollToFn(toOffset - outerSize / 2)
      }
    },
    [scrollToFn]
  )

  const tryScrollToIndex = React.useCallback(
    (index, { align = 'auto', ...rest } = {}) => {
      const { measurements, scrollOffset, outerSize } = latestRef.current

      const measurement = measurements[Math.max(0, Math.min(index, size - 1))]

      if (!measurement) {
        return
      }

      if (align === 'auto') {
        if (measurement.end >= scrollOffset + outerSize) {
          align = 'end'
        } else if (measurement.start <= scrollOffset) {
          align = 'start'
        } else {
          return
        }
      }

      const toOffset =
        align === 'center'
          ? measurement.start + measurement.size / 2
          : align === 'end'
          ? measurement.end
          : measurement.start

      scrollToOffset(toOffset, { align, ...rest })
    },
    [scrollToOffset, size]
  )

  const scrollToIndex = React.useCallback(
    (...args) => {
      // We do a double request here because of
      // dynamic sizes which can cause offset shift
      // and end up in the wrong spot. Unfortunately,
      // we can't know about those dynamic sizes until
      // we try and render them. So double down!
      tryScrollToIndex(...args)
      requestAnimationFrame(() => {
        tryScrollToIndex(...args)
      })
    },
    [tryScrollToIndex]
  )

  return {
    virtualItems,
    totalSize,
    scrollToOffset,
    scrollToIndex,
    measure,
    onScroll,
    onLayout,
  }
}

const findNearestBinarySearch = (low, high, getCurrentValue, value) => {
  while (low <= high) {
    let middle = ((low + high) / 2) | 0
    let currentValue = getCurrentValue(middle)

    if (currentValue < value) {
      low = middle + 1
    } else if (currentValue > value) {
      high = middle - 1
    } else {
      return middle
    }
  }

  if (low > 0) {
    return low - 1
  } else {
    return 0
  }
}

function calculateRange({ measurements, outerSize, scrollOffset }, prevRange) {
  const size = measurements.length - 1
  const getOffset = index => measurements[index].start

  let start = findNearestBinarySearch(0, size, getOffset, scrollOffset)
  let end = start

  while (end < size && measurements[end].end < scrollOffset + outerSize) {
    end++
  }

  if (prevRange.start !== start || prevRange.end !== end) {
    return { start, end }
  }

  return prevRange
}
