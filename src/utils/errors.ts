import Joi from 'joi';

export class InvalidConfigError extends Error {
    constructor(error: Joi.ValidationError) {
        const message = `Invalid configuration: \n${error.details.map(detail => detail.message).join(',\n')}`;
        super(message);
    }
}