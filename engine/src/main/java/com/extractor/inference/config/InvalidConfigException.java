package com.extractor.inference.config;

/**
 * An unusable inference configuration (FR-009). Subclass of
 * {@link IllegalArgumentException} so the command line and the server mode
 * report it like any other invalid argument.
 */
public final class InvalidConfigException extends IllegalArgumentException {

    /** Serialization version. */
    private static final long serialVersionUID = 1L;

    /**
     * Error with its complete message.
     *
     * @param message the message
     */
    public InvalidConfigException(final String message) {
        super(message);
    }

    /**
     * Error about one parameter.
     *
     * @param path   dotted path of the parameter
     * @param reason why it is invalid
     * @return the exception
     */
    public static InvalidConfigException parameter(final String path,
            final String reason) {
        return new InvalidConfigException("Invalid inference configuration: "
                + path + ": " + reason);
    }

    /**
     * Error about a configuration file.
     *
     * @param file   the file as given
     * @param reason why it is unusable
     * @return the exception
     */
    public static InvalidConfigException file(final String file,
            final String reason) {
        return new InvalidConfigException("Inference configuration file '"
                + file + "' " + reason);
    }
}
