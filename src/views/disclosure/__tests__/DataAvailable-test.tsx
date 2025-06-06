import React from 'react'
import { screen, render } from 'src/utilities/testingLibrary'

import { DataAvailable } from 'src/views/disclosure/DataAvailable'

import { getDataClusters } from 'src/const/DataClusters'

describe('DataAvailable', () => {
  const { dataClusters } = getDataClusters()
  it('renders component with 8 dataClusters', async () => {
    let clusterCount = 0
    render(<DataAvailable />)

    Object.values(dataClusters).forEach((cluster) => {
      const dataCluster = screen.getByText(cluster.name)

      expect(dataCluster).toBeInTheDocument()
      clusterCount++
    })

    expect(clusterCount).toBe(8)
  })
})
