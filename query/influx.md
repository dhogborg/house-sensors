## combine energy, price into total cost

```flux
t1 = from(bucket: "pricing/autogen")
  |> range(start: dashboardTime)
  |> filter(fn: (r) => r._measurement == "price" and (r._field == "total"))
  |> window(every: 1h)
  |> group(columns: [])
  |> keep(columns: ["_time", "_value"])
  |> fill(usePrevious: true)

t2 = from(bucket: "energy/autogen")
  |> range(start: dashboardTime)
  |> filter(fn: (r) => r._measurement == "electricity" and (r._field == "power"))
  |> filter(fn: (r) => r.phase == "combined")
  |> aggregateWindow(every: 1h, fn: mean)
  |> map(fn: (r) => ({_time: r._time, _value: r._value / 1000.0}))
  |> group(columns: [])
  |> keep(columns: [ "_time", "_value"])
  |> fill(usePrevious: true)


join(tables: {price: t1, energy: t2}, on: ["_time"])
  |> map(fn: (r) => ({r with _value_cost: r._value_energy  * r._value_price}))

```
