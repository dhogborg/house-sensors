import React from 'react'

import EnergyClock from './EnergyClock'

describe('<EnergyClock />', () => {
  it('renders', () => {
    const props = {
      pv: 0,
      usage: 0,
      grid: 0,
      battery: 0,
    }
    cy.viewport(800, 1200)
    cy.mount(
      <div
        style={{
          flex: 1,
          flexDirection: 'row',
        }}
      >
        <EnergyClock {...props} usage={1000} grid={1000} title="1 kW Ref" />
        <EnergyClock {...props} usage={2000} grid={2000} title="2 kW Ref" />
        <EnergyClock {...props} usage={3000} grid={3000} title="3 kW Ref" />
        <hr />
        <EnergyClock {...props} usage={2000} grid={2000} title="no pv" />
        <EnergyClock
          {...props}
          pv={1000}
          usage={2000}
          grid={1000}
          title="some pv"
        />
        <EnergyClock
          {...props}
          pv={3000}
          usage={2000}
          grid={-1000}
          title="some export"
        />

        <EnergyClock
          {...props}
          usage={2000}
          grid={3000}
          battery={1000}
          title="no pv, +batt"
        />
        <EnergyClock
          {...props}
          pv={1000}
          usage={2000}
          grid={2000}
          battery={1000}
          title="some pv +batt"
        />
        <EnergyClock
          {...props}
          pv={3000}
          usage={2000}
          grid={-500}
          battery={500}
          title="some export +batt"
        />

        <EnergyClock
          {...props}
          usage={2000}
          grid={1500}
          battery={-500}
          title="no pv, -batt"
        />
        <EnergyClock
          {...props}
          pv={1000}
          usage={2000}
          grid={500}
          battery={-500}
          title="some pv -batt"
        />
        <EnergyClock
          {...props}
          pv={2000}
          usage={2000}
          grid={-500}
          battery={-500}
          title="some export -batt"
        />

        <EnergyClock
          {...props}
          pv={0}
          usage={2000}
          grid={0}
          battery={-2000}
          title="grid neutral -batt"
        />

        <EnergyClock
          {...props}
          pv={1000}
          usage={2000}
          grid={0}
          battery={-1000}
          title="grid neutral -batt"
        />
        <EnergyClock
          {...props}
          pv={3000}
          usage={2000}
          grid={0}
          battery={1000}
          title="grid neutral +batt"
        />
        <hr />
        <EnergyClock
          {...props}
          usage={500}
          grid={-5000}
          battery={-5500}
          title="Large export"
        />
        <EnergyClock
          {...props}
          pv={3500}
          usage={4000}
          battery={-5500}
          grid={-5000}
          title="Large everything"
        />
        <EnergyClock
          {...props}
          usage={2000}
          grid={5500}
          battery={3500}
          title="Large import"
        />
      </div>,
    )
  })
})
