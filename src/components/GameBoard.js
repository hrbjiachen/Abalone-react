import React, { Component } from 'react';
import {
    isLegalGroup, moveMarbles, getMoveDirection, isLegalMove, generateHistoryText, locationSelected,
    getNextStateByAIAction, getNextState, generateSupportlineTexts, getChangeInfoArrayFromAIMove
} from '../utils/UtilFunctions';
import AbaloneClient from '../utils/AbaloneClient';
import { Button, Col, Progress, Row, Modal, message, Spin } from 'antd';
import GameInfoBoard from './GameInfoBoard';
import GameResult from './GameResult';
import DrawGameBoard, { boardArray } from './DrawGameBoard';

export default class GameBoard extends Component {

    constructor(props) {
        super(props);
        this.state = {
            selectedHex: [],
            supportLine: [],
            curState: [],
            lastState: [],
            stateOption: 1,
            progress: 100,
            timeLeft: 0,
            pause: false,
            start: false,
            moveHistory: [],
            serverConfirmVisible: false,
            gameResultVisible: false
        }

    }

    componentWillMount() {
        this.setState({
            ...this.props.gameSettings,
            curState: this.props.gameSettings.boardInitState,
            turn: 1
        });
    }

    componentDidMount = () => {
        const { whiteTimeLimit, blackTimeLimit } = this.props.gameSettings;

        if (this.props.gameSettings.gameType === "pve") {
            AbaloneClient.connect();
        }

        if (!whiteTimeLimit && !blackTimeLimit) {
            this.setState({ start: true });
            this.shouldAIMove();
        }
    }

    componentWillUnmount = () => {
        if (this.state.clock) {
            clearInterval(this.state.clock);
        }

        if (this.props.gameSettings.gameType === "pve") {
            AbaloneClient.close();
        }
    }

    clickMarble = (e) => {
        const { start, changeInfoArray, turn, supportLine, selectedHex, curState } = this.state;
        const { gameType, playerColor } = this.props.gameSettings;
        const color = parseInt(e.target.getAttribute('color'));
        const position = e.target.getAttribute('location');

        if (!start) {
            return;
        }

        //black move in odd turn, white move in even turn
        if (!changeInfoArray && turn % 2 === (2 - color)) {
            return;
        }

        //AI turn
        if (!changeInfoArray && gameType === "pve" && playerColor !== color) {
            return;
        }

        //check if clicked marble is selected
        if (locationSelected(selectedHex, position)) {
            //deselect
            this.setState({ selectedHex: [] });
        } else {
            if (supportLine.length) {
                //push marble
                this.setState({ selectedHex: [], supportLine: [] });
                this.makeMove(changeInfoArray);
            } else {
                //select marbles
                const newSelected = (selectedHex.length >= 3) ? [position] :
                    isLegalGroup(selectedHex, position, curState);
                this.setState({ selectedHex: newSelected });
            }
        }
    }

    clickHex = () => {
        const { supportLine, changeInfoArray } = this.state;
        if (supportLine.length) {
            //move marble
            this.setState({
                selectedHex: [],
                supportLine: []
            });
            this.makeMove(changeInfoArray);
        }
    }

    mouseOverHex = (e) => {
        if (!this.state.selectedHex.length) {
            return;
        }

        const moveDirection = getMoveDirection(this.state.selectedHex, e.target.getAttribute('location'));

        if (moveDirection !== -1) {
            const changeInfoArray = isLegalMove(this.state.selectedHex, moveDirection, boardArray, this.state.curState);

            if (changeInfoArray) {
                const points = generateSupportlineTexts(this.state.selectedHex, boardArray, moveDirection);
                this.showSupportLine(points, changeInfoArray);
            }

        }
    }

    mouseOutHex = (e) => {
        this.hideSupportLine();
    }

    showSupportLine = (points, changeInfoArray) => {

        if (!points.length) {
            return;
        }

        this.setState({
            supportLine: points,
            changeInfoArray
        })
    }

    hideSupportLine = () => {
        this.setState({
            supportLine: [],
            changeInfoArray: null
        })
    }

    makeMove = async (changeInfoArray) => {
        if (!changeInfoArray || !changeInfoArray.length) {
            return;
        }

        //move all selected marbles
        await moveMarbles(changeInfoArray);

        //update move history board
        this.updateMoveHistoryBoard(changeInfoArray);

        //update board state
        const nextState = getNextState(changeInfoArray, this.state.curState);
        this.updateBoardState(nextState);

        //end game if exceeds turn limit
        if (!this.isGameEnd()) {
            this.shouldAIMove();
        }
    }

    shouldAIMove = () => {
        const { gameType, whiteMoveLimit, blackMoveLimit, whiteTimeLimit, blackTimeLimit, 
            autoSwitchTurn, moveLimitChecked, timeLimitChecked } = this.props.gameSettings;
        const { turn, playerColor, curState } = this.state;

        if (gameType === "pvp" || (turn % 2 !== (2 - playerColor))) {
            return;
        }

        const timeLimit = timeLimitChecked ? (turn % 2 === 0 ? whiteTimeLimit : blackTimeLimit) : 10;
        const turnLimit = moveLimitChecked ? (playerColor === 2 ? whiteMoveLimit : blackMoveLimit) : 80;
        const packet = {
            turnLimit,
            timeLimit,
            turn,
            state: curState,
        };

        const dialog = autoSwitchTurn? 
            Modal.info({
                content: <div><Spin />  Waiting AI Move...</div>,
                centered: true
            }) : 
            Modal.confirm({
                title: 'AI Next Move',
                content: <div><Spin />  Waiting AI Move...</div>,
                cancelType: "danger",
                okText: "Move",
                cancelText: "Undo",
                okButtonProps: { disabled: true },
                cancelButtonProps: { disabled: true },
                centered: true
            });

        let that = this;

        AbaloneClient.nextMove(packet).then(({ action }) => {
            const changeInfoArray = getChangeInfoArrayFromAIMove(action, curState, boardArray);
            if (autoSwitchTurn) {
                dialog.destroy();
                that.doAIMove(action, changeInfoArray);
            } else {
                that.pauseGame();
                const history = this.generateMoveAction(changeInfoArray);
                const { text, marbles, direction } = history;
                   
                dialog.update({
                    content: (
                        <div>
                            {text}
                            <DrawGameBoard
                                selectedHex={history.marbles}
                                boardState={history.boardState}
                                supportLine={generateSupportlineTexts(marbles, boardArray, direction)}
                            />
                        </div>
                    ),
                    onOk() {
                        that.doAIMove(action, changeInfoArray);
                        that.pauseGame();
                        dialog.destroy();
                    },
                    onCancel() {
                        that.undoLastMove();
                        dialog.destroy();
                    },
                    okButtonProps: { disabled: false },
                    cancelButtonProps: { disabled: false }
                });
            }
        });

    }

    doAIMove = async (action, changeInfoArray) => {
        const { curState } = this.state;
        const nextState = getNextStateByAIAction(curState, action);
        await moveMarbles(changeInfoArray);
        this.updateMoveHistoryBoard(changeInfoArray);
        this.updateBoardState(nextState);
    }

    generateMoveAction = (changeInfoArray) => {
        //update move history
        let marbles = [];

        changeInfoArray.forEach(element => {
            marbles.push([element.originLocation]);
        })

        const { whiteTimeLimit, blackTimeLimit } = this.props.gameSettings;
        const timeLimit = this.state.turn % 2 === 0 ? whiteTimeLimit : blackTimeLimit

        let action = {
            turn: this.state.turn,
            marbles,
            direction: changeInfoArray[0].direction,
            time: timeLimit - this.state.timeLeft,
            boardState: this.state.curState
        }

        action.text = generateHistoryText(action);
        return action;
    }

    updateMoveHistoryBoard = (changeInfoArray) => {
        this.setState(prevState => ({
            moveHistory: [...prevState.moveHistory, this.generateMoveAction(changeInfoArray)]
        }));
    }

    updateBoardState = (boardState) => {
        if (this.state.clock) {
            clearInterval(this.state.clock);
        }

        const { whiteTimeLimit, blackTimeLimit } = this.props.gameSettings;

        this.setState(prevState => ({
            lastState: prevState.curState,
            curState: boardState,
            timeLeft: prevState.turn % 2 === 1 ? whiteTimeLimit : blackTimeLimit,
            progress: 100,
            pause: false,
            turn: prevState.turn + 1
        }));

        this.startTimer();

    }

    isGameEnd = () => {
        const { whiteMoveLimit, blackMoveLimit } = this.props.gameSettings;
        const { turn } = this.state;
        if (turn > whiteMoveLimit + blackMoveLimit && whiteMoveLimit && whiteMoveLimit) {
            this.stopGame();
            return true;
        } else {
            return false;
        }
    }

    startGame = () => {
        if (!AbaloneClient.connected && this.state.gameType === "pve") {
            this.setState({ serverConfirmVisible: true });
        } else {
            this.setState({
                start: true,
                timeLeft: this.props.gameSettings.blackTimeLimit
            });
            this.shouldAIMove();
            this.startTimer();
        }
    }

    pauseGame = () => {
        if (this.state.pause) {
            this.setState({ pause: false });
            this.startTimer();
        } else {
            this.setState({ pause: true });
        }
    }

    leaveGame = () => {
        this.props.stopGame();
    }

    stopGame = () => {
        this.setState({
            pause: true,
            gameResultVisible: true
        });
    }

    closeResultWindow = () => {
        this.setState({
            gameResultVisible: false
        });
    }

    resetGame = () => {
        if (this.state.clock) {
            clearInterval(this.state.clock);
        }

        const { timeLimitChecked, boardInitState } = this.props.gameSettings;

        this.setState({
            curState: boardInitState,
            gameResultVisible: false,
            turn: 1,
            progress: 100,
            pause: false,
            timeLeft: 0,
            selectedHex: [],
            moveHistory: []
        });

        if (!timeLimitChecked) {
            this.setState({ start: true });
        } else {
            this.setState({ start: false });
        }

    }

    undoLastMove = () => {
        if (!this.state.lastState.length) {
            return;
        }

        const { whiteTimeLimit, blackTimeLimit } = this.props.gameSettings;
        let copyMoveHistory = [...this.state.moveHistory];
        copyMoveHistory.pop();

        this.setState(prevState => ({
            lastState: [],
            curState: prevState.lastState,
            timeLeft: prevState.turn % 2 === 1 ? whiteTimeLimit : blackTimeLimit,
            progress: 100,
            pause: true,
            turn: prevState.turn - 1,
            moveHistory: copyMoveHistory
        }));
    }

    startTimer = () => {
        const { timeLimitChecked, whiteTimeLimit, blackTimeLimit } = this.props.gameSettings;

        if (!timeLimitChecked) {
            return;
        }

        if (this.state.clock) {
            clearInterval(this.state.clock);
        }

        const period = 10;

        let clock = setInterval(() => {
            if (this.state.pause) {
                clearInterval(clock);
            } else {
                if (this.state.timeLeft > 0) {
                    let timeLeft = this.state.timeLeft - 1 / period;
                    let timeLimit = this.state.turn % 2 === 0 ? whiteTimeLimit : blackTimeLimit;
                    let progress = (timeLeft / timeLimit) * 100;

                    this.setState({
                        timeLeft, progress
                    })
                } else {
                    clearInterval(clock);
                }
            }
        }, 1000 / period);

        this.setState({ clock });
    }

    connectServer = async () => {
        this.closeServerConfirmBox();
        setTimeout(() => {
            if (!AbaloneClient.connected) {
                message.error('Unable to connect server!');
            }
        }, 2000);
        await AbaloneClient.connect();
        this.startGame();
    }

    closeServerConfirmBox = () => {
        this.setState({ serverConfirmVisible: false });
    }

    render() {

        const startIcon = this.state.start ? (this.state.pause ? "step-forward" : "pause-circle") : "caret-right";
        const startClickFunction = this.state.start ? this.pauseGame : this.startGame;
        const { timeLimitChecked, moveLimitChecked, whiteMoveLimit, blackMoveLimit } = this.props.gameSettings;

        return (
            <div>
                <Row>
                    <Col span={11} offset={1}>
                        <div style={{ margin: 30 }}>
                            <Row gutter={4}>
                                {timeLimitChecked ?
                                    <Col span={5} offset={1}>
                                        <Button type="primary" size="large" icon={startIcon} onClick={startClickFunction} block>
                                            {this.state.start ? (this.state.pause ? "Resume" : "Pause") : "Start"}
                                        </Button>
                                    </Col> : <Col span={5} offset={1}></Col>}

                                <Col span={5}>
                                    <Button type="danger" size="large" icon="stop" onClick={this.stopGame} block> Stop </Button>
                                </Col>
                                <Col span={5}>
                                    <Button size="large" icon="rollback" onClick={this.resetGame} block> Reset </Button>
                                </Col>
                                <Col span={5}>
                                    <Button type="dashed" icon="backward" size="large" onClick={this.undoLastMove} block> Undo </Button>
                                </Col>
                            </Row>
                        </div>
                        <div>
                            <DrawGameBoard
                                boardState = {this.state.curState}
                                selectedHex = {this.state.selectedHex}
                                supportLine={this.state.supportLine}
                                mouseOverHex={this.mouseOverHex}
                                mouseOutHex={this.mouseOutHex}
                                clickHex={this.clickHex}
                                clickMarble={this.clickMarble}
                            />
                        </div>

                        {timeLimitChecked ?
                            <div style={{ margin: 20 }}>
                                <Progress showInfo={false} strokeWidth={20} strokeColor="square" strokeLinecap="round" percent={this.state.progress} />
                            </div> : null}

                    </Col>
                    <Col span={10} offset={1}>
                        <GameInfoBoard gameInfo={this.state} />
                    </Col>
                </Row>

                <Modal
                    title="Server Disconnected"
                    visible={this.state.serverConfirmVisible}
                    onOk={this.connectServer}
                    onCancel={this.closeServerConfirmBox}
                    okText="Reconnect"
                    cancelText="Cancel"
                >
                    Server disconnected. Do you want to re-connect?
                </Modal>

                <Modal
                    title="Game Result"
                    visible={this.state.gameResultVisible}
                    maskClosable={false}
                    closable={false}
                    width={1200}
                    centered
                    footer={[
                        <Row gutter={24} key="buttons">
                            {!moveLimitChecked || (moveLimitChecked && this.state.turn <= whiteMoveLimit + blackMoveLimit) ?
                                <Col span={6} offset={2}>
                                    <Button type="primary" onClick={this.closeResultWindow} block>Continue</Button>
                                </Col> :
                                <Col span={10}></Col>}
                            <Col span={6} offset={1}>
                                <Button onClick={this.resetGame} block>Play another game</Button>
                            </Col>
                            <Col span={6} offset={1}>
                                <Button type="danger" onClick={this.leaveGame} block>Leave game</Button>
                            </Col>
                        </Row>
                    ]}
                >
                    <GameResult gameInfo={this.state} />
                </Modal>
            </div>
        )
    }
}

