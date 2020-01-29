import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Image,
  NativeModules,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated
} from 'react-native';
import { calculateCornerResult, msToSec } from '../utils';

const { RNTrimmerManager: TrimmerManager } = NativeModules;
const { width } = Dimensions.get('window');

const getStyles = ({trackerHandleColor}) => StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row'
  },
  imageItem: {
    flex: 1,
    width: 50,
    height: 50,
    resizeMode: 'cover'
  },
  corners: {
    position: 'absolute',
    height: 50,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rightCorner: {
    position: 'absolute',
    flex: 1,
  },
  leftCorner: {
    left: 0
  },
  bgBlack: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width
  },
  cornerItem: {
    backgroundColor: trackerHandleColor,
    width: 20,
    height: 50
  }
});
export class Trimmer extends Component {
  static propTypes = {
    source: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onChange: PropTypes.func,
    width: PropTypes.number,
    height: PropTypes.number,
    showTrackerHandle: PropTypes.bool,
    trackerHandleColor: PropTypes.string,
    themeColor: PropTypes.string,
    onTrackerMove: PropTypes.func,
    minLength: PropTypes.number,
    maxLength: PropTypes.number,
    currentTime: PropTypes.number,
    trackerColor: PropTypes.string,
    thumbWidth: PropTypes.number,
    borderWidth: PropTypes.number,
  };
  static defaultProps = {
    onChange: () => null,
    themeColor: 'gray',
    trackerColor: 'black',
    trackerHandleColor: 'gray',
    showTrackerHandle: false
  };
  styles = getStyles(this.props)
  constructor(props) {
    super(props);
    this.state = {
      images: [],
      duration: -1,
      leftCorner: new Animated.Value(0),
      rightCorner: new Animated.Value(0),
      layoutWidth: width
    };

    this.leftResponder = null;
    this.rigthResponder = null;

    this._startTime = 0;
    this._endTime = 0;
    this._handleRightCornerMove = this._handleRightCornerMove.bind(this);
    this._handleLeftCornerMove = this._handleLeftCornerMove.bind(this);
    this._retriveInfo = this._retriveInfo.bind(this);
    this._retrivePreviewImages = this._retrivePreviewImages.bind(this);
    this._handleRightCornerRelease = this._handleRightCornerRelease.bind(this);
    this._handleLeftCornerRelease = this._handleLeftCornerRelease.bind(this);
  }

  componentWillMount() {
    // @TODO: Cleanup on unmount
    this.state.leftCorner.addListener(({ value }) => this._leftCornerPos = value);
    this.state.rightCorner.addListener(({ value }) => this._rightCornerPos = value);

    this.leftResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onMoveShouldSetPanResponderCapture: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onPanResponderMove: this._handleLeftCornerMove,
      onPanResponderRelease: this._handleLeftCornerRelease
    });

    this.rightResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onMoveShouldSetPanResponderCapture: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onPanResponderMove: this._handleRightCornerMove,
      onPanResponderRelease: this._handleRightCornerRelease
    });
    const { source = '' } = this.props;
    if (!source.trim()) {
      throw new Error('source should be valid string');
    }
    this._retrivePreviewImages();
    this._retriveInfo();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.source !== this.props.source) {
      this._retrivePreviewImages();
      this._retriveInfo();
    }
  }

  componentWillUnmount() {
    this.state.leftCorner.removeAllListeners();
    this.state.rightCorner.removeAllListeners();
  }

  _handleLeftCornerRelease() {
    this.state.leftCorner.setOffset(this._leftCornerPos);
    this.state.leftCorner.setValue(0);
  }

  _handleRightCornerRelease() {
    this.state.rightCorner.setOffset(this._rightCornerPos);
    this.state.rightCorner.setValue(0);
  }

  _handleRightCornerMove(e, gestureState) {
    const { duration, layoutWidth } = this.state;
    const leftPos = this._leftCornerPos;
    const rightPos = layoutWidth - Math.abs(this._rightCornerPos);
    const moveLeft = gestureState.dx < 0;
    if (rightPos - leftPos <= 50 && moveLeft) {
      return;
    }
    this._endTime = calculateCornerResult(duration, this._rightCornerPos, layoutWidth, true);

    this._callOnChange();
    Animated.event([
      null, { dx: this.state.rightCorner }
     ])(e, gestureState);
  }

  _handleLeftCornerMove(e, gestureState) {
    const { duration, layoutWidth } = this.state;
    const leftPos = this._leftCornerPos;
    const rightPos = layoutWidth - Math.abs(this._rightCornerPos);
    const moveRight = gestureState.dx > 0;

    if (rightPos - leftPos <= 50 && moveRight) {
      return;
    }

    this._startTime = calculateCornerResult(duration, this._leftCornerPos, layoutWidth);
    this._callOnChange();

    Animated.event([
      null,
       { dx: this.state.leftCorner }
     ])(e, gestureState);
  }

  _callOnChange() {
    this.props.onChange({
      startTime: this._startTime,
      endTime: this._endTime
    });
  }

  _retriveInfo() {
    TrimmerManager
      .getVideoInfo(this.props.source)
      .then((info) => {
        this.setState(() => ({
          ...info,
          duration: msToSec(info.duration)
        }));
        this._endTime = msToSec(info.duration);
      });
  }

  _retrivePreviewImages() {
    TrimmerManager
      .getPreviewImages(this.props.source)
      .then(({ images }) => {
        this.setState({ images });
      })
      .catch((e) => console.error(e));
  }

  renderLeftSection() {
    const { leftCorner, layoutWidth } = this.state;
    return (
      <Animated.View
        style={[this.styles.container, this.styles.leftCorner, {
          left: - layoutWidth,
          transform: [{
            translateX: leftCorner,
          }]
        }]}
        {...this.leftResponder.panHandlers}
      >
        <View style={this.styles.row}>
          <View style={this.styles.bgBlack} />
          <View style={this.styles.cornerItem} />
        </View>
      </Animated.View>
    );
  }

  renderRightSection() {
    const { rightCorner, layoutWidth } = this.state;
    return (
      <Animated.View
        style={[this.styles.container, this.styles.rightCorner, { right: -layoutWidth + 20 }, {
          transform: [{
            translateX: rightCorner
          }]
        }]}
        {...this.rightResponder.panHandlers}
      >
        <View style={this.styles.row}>
          <View style={this.styles.cornerItem} />
          <View style={this.styles.bgBlack} />
        </View>
      </Animated.View>
    )
  }

  render() {
    const { images } = this.state;
    return (
      <View
        style={this.styles.container}
        onLayout={({ nativeEvent }) => {
          this.setState({
            layoutWidth: nativeEvent.layout.width
          });
        }}
      >
        {images.map((uri,index) => (
          <Image
            key={`preview-source-${uri}-${index}`}
            source={{ uri }}
            style={this.styles.imageItem}
          />
        ))}
        <View style={this.styles.corners}>
          {this.renderLeftSection()}
          {this.renderRightSection()}
        </View>
      </View>
    );
  }
}
