import React, { Component } from 'react';
import { Timeline, Statistic, Card, Row, Col, Icon } from 'antd';

export default class GameInfoBoard extends Component {

  //color white 1, black 2
  getTimer = (color) => {
    let timer = 0;
    if (color === 1) {
      if (this.props.gameInfo.turn % 2 === 0) {
        timer = this.props.gameInfo.timeLeft
      }
    } else {
      if (this.props.gameInfo.turn % 2 === 1) {
        timer = this.props.gameInfo.timeLeft
      }
    }
    return Math.round(timer * 100) / 100;
  }
  render() {
    const whiteBkStyle = (this.props.gameInfo.turn % 2 === 0) ? {} : { opacity: 0.5 };
    const blackBkStyle = (this.props.gameInfo.turn % 2 === 1) ? {} : { opacity: 0.5 };

    const whiteTimelineStyle = (this.props.gameInfo.turn % 2 === 0) ? { minHeight: '60vh', maxHeight: '60vh' } : { opacity: 0.5, minHeight: '60vh', maxHeight: '60vh' };
    const blackTimelineStyle = (this.props.gameInfo.turn % 2 === 1) ? { minHeight: '60vh', maxHeight: '60vh' } : { opacity: 0.5, minHeight: '60vh', maxHeight: '60vh' };
    const turnSuffix = `/ ${this.props.gameInfo.moveLimit * 2}`;
    return (
      <div style={{ maxHeight: 600 }}>

        <Row>
          <div style={{ margin: 20, float: "right" }}>
            <Statistic value={this.props.gameInfo.turn} prefix="Turn: " suffix={turnSuffix} valueStyle={{ fontSize: 40, color: "#fafafa" }} />
          </div>
        </Row>

        <Row gutter={16}>

          <Col span={12}>
            <Card style={blackBkStyle} >
              <Row>
                <Col span={12}>
                  <Statistic
                    title="Black Player"
                    value={1}
                    precision={0}
                    valueStyle={{ color: '#cf1322' }}
                    prefix={<Icon type="frown" />}
                  />
                </Col>

                <Col span={12}>
                  <Statistic title="Time" value={this.getTimer(2)} suffix=" s" />
                </Col>
              </Row>
            </Card>

            <Card style={blackTimelineStyle}>
              <Timeline>
                {this.props.gameInfo.blackMoveHistory.length && this.props.gameInfo.blackMoveHistory.map((history, key) => {
                  return key === (this.props.gameInfo.blackMoveHistory.length - 1) ?
                    <Timeline.Item key={key} color="green">{history}</Timeline.Item> :
                    <Timeline.Item key={key} color="blue">{history}</Timeline.Item>
                })}
              </Timeline>
            </Card>

          </Col>

          <Col span={12} >
            <Card style={whiteBkStyle}>
              <Row>
                <Col span={12}>
                  <Statistic
                    title="White Player"
                    value={3}
                    precision={0}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<Icon type="smile" />}
                  />
                </Col>

                <Col span={12} >
                  <Statistic title="Time" value={this.getTimer(1)} suffix=" s" />
                </Col>
              </Row>
            </Card>

            <Card style={whiteTimelineStyle}>
              <Timeline>
                {this.props.gameInfo.whiteMoveHistory.length && this.props.gameInfo.whiteMoveHistory.map((history, key) => {
                  return key === (this.props.gameInfo.whiteMoveHistory.length - 1) ?
                    <Timeline.Item key={key} color="green">{history}</Timeline.Item> :
                    <Timeline.Item key={key} color="blue">{history}</Timeline.Item>
                })}
              </Timeline>
            </Card>

          </Col>
        </Row>
      </div>

    )
  }
}
