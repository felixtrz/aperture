export const config = {
  mode: 'browser', canvas: '#aperture', systems: [], physics: false,
  render: {
    defaultCamera: false, defaultLight: false, defaultEnvironment: false,
    tonemap: 'aces', exposure: 1, sampleCount: 4, maxPixelRatio: 1,
    cadence: 'demand',
  },
  diagnostics: { level: 'info' },
};
