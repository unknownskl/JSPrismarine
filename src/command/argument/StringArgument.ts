import { CommandParameterType } from '../../network/type/CommandParameter';
import CommandExecuter from '../CommandExecuter';
import Argument from './Argument';

export default class StringArgument extends Argument<string> {
    #extends: boolean = false;
    // whether or not the argument extends into the next one.
    public constructor(name: string = 'string', extend: boolean = false) {
        super(name);
        this.#extends = extend || false;
        this.extendsTo;
        this.type = CommandParameterType.RawText;
    }
    public parse(
        executer: CommandExecuter,
        arg: string,
        currentStack: Argument<unknown>[],
        strArgs: string[]
    ) {
        if (this.#extends) {
            // consumes all other arguments!
            return strArgs.slice(0)?.join(' ') || null;
        }
        return arg; // this is a hack.
    }
}