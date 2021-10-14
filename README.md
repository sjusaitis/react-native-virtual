# React Native Virtual

Hooks for virtualizing scrollable elements in React Native, a fork of
Tanner Linsley's
[React Virtual](https://github.com/tannerlinsley/react-virtual).

## API changes from React Virtual

The API is largely the same as [React Virtual](https://react-virtual.tanstack.com/docs/api),
except:

#### Options

- no `useObserver` (functionality replaced by the `onLayout` return).

#### Returns

- `virtualItems` → `measureOnLayout`: optional prop that can be placed
  on the child view to perform dynamic measurement (used insted
  of React Virtual's `measureRef`).
- `onLayout`: prop to attach to parent ScrollView component
- `onScroll`: prop to attach to parent ScrollView component

### `useVirtual()`

```
 const {
   virtualItems: [
     { key, index, start, size, end, measureOnLayout },
     /* ... */
   ],
   totalSize,
   scrollToIndex,
   scrollToOffset,
   onLayout,
   onScroll,
 } = useVirtual({
   size,
   parentRef,
   estimateSize,
   overscan,
   horizontal,
   scrollToFn,
 })
```

## Usage

```
function RowVirtualizer() {
  const parentRef = React.useRef();

  const virtualizer = useVirtual({
    size: 1000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
  });

  return (
    <ScrollView
      ref={parentRef}
      scrollEventThrottle={16}
      onScroll={virtualizer.onScroll}
      onLayout={virtualizer.onLayout}
    >
      <View style={{ height: virtualizer.totalSize }}>
        {virtualizer.virtualItems.map((virtualRow) => (
          <View
            key={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: [{ translateY: virtualRow.start }],
            }}
          >
            Row {virtualRow.index}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

```
