// __mocks__/svgMock.js
// Jest cannot process .svg through react-native-svg-transformer (Metro-only).
// Every .svg import resolves to this inert component instead.
const React = require('react');

function SvgMock(props) {
  return React.createElement('SvgMock', props, props.children);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
