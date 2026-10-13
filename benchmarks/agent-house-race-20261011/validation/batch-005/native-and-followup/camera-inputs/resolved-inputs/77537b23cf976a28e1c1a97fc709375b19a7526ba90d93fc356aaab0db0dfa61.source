let CHECKS_ON = true;
export function toggleChecks(value) {
    CHECKS_ON = value;
}
export var ErrorMessages;
(function (ErrorMessages) {
    ErrorMessages["TypeNotSupported"] = "Type not supported";
    ErrorMessages["InvalidDefaultValue"] = "Invalid default value";
    ErrorMessages["InvalidEnumValue"] = "Invalid enum value";
    ErrorMessages["InvalidRangeValue"] = "Value out of range";
})(ErrorMessages || (ErrorMessages = {}));
export function assertCondition(condition, message, object) {
    if (CHECKS_ON && !condition) {
        throw new Error(`${message}: ${object}`);
    }
}
export function assertValidEnumValue(value, enumObject, fieldName) {
    if (!CHECKS_ON) {
        return;
    }
    const enumValues = Object.values(enumObject);
    if (!enumValues.includes(value)) {
        throw new Error(`${ErrorMessages.InvalidEnumValue}: ${value} is not a valid value for enum ${fieldName}`);
    }
}
export function assertValidRangeValue(value, min, max, fieldName) {
    if (!CHECKS_ON) {
        return;
    }
    if (min !== undefined && value < min) {
        throw new Error(`${ErrorMessages.InvalidRangeValue}: ${value} is below minimum ${min} for field ${fieldName}`);
    }
    if (max !== undefined && value > max) {
        throw new Error(`${ErrorMessages.InvalidRangeValue}: ${value} is above maximum ${max} for field ${fieldName}`);
    }
}
//# sourceMappingURL=checks.js.map