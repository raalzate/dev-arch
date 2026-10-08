package com.extractor.mcp;

import io.modelcontextprotocol.json.TypeRef;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransport;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Transport provider that serializes the outgoing messages of its sessions
 * (007-native-engine-runtime, FR-010/FR-023). The SDK stdio transport
 * rejects a message emitted while another one is being emitted ("Failed to
 * enqueue message"); with two analyses running at the same time their
 * responses and progress notifications would otherwise be lost.
 */
public final class SerializedTransportProvider
        implements McpServerTransportProvider {

    /** Wrapped provider (stdio). */
    private final McpServerTransportProvider delegate;

    /**
     * Wraps a provider.
     *
     * @param wrapped the provider whose transports are serialized
     */
    public SerializedTransportProvider(
            final McpServerTransportProvider wrapped) {
        this.delegate = wrapped;
    }

    @Override
    public void setSessionFactory(final McpServerSession.Factory factory) {
        delegate.setSessionFactory(
                transport -> factory.create(new Serialized(transport)));
    }

    @Override
    public Mono<Void> notifyClients(final String method,
            final Object params) {
        return delegate.notifyClients(method, params);
    }

    @Override
    public Mono<Void> closeGracefully() {
        return delegate.closeGracefully();
    }

    @Override
    public void close() {
        delegate.close();
    }

    @Override
    public List<String> protocolVersions() {
        return delegate.protocolVersions();
    }

    /** Session transport whose sends never overlap. */
    private static final class Serialized implements McpServerTransport {

        /** Wrapped session transport. */
        private final McpServerTransport transport;

        /** Lock held while a message is handed to the transport. */
        private final Object lock = new Object();

        Serialized(final McpServerTransport session) {
            this.transport = session;
        }

        @Override
        public Mono<Void> sendMessage(final McpSchema.JSONRPCMessage message) {
            return Mono.defer(() -> {
                synchronized (lock) {
                    try {
                        transport.sendMessage(message).block();
                    } catch (RuntimeException e) {
                        return Mono.<Void>error(e);
                    }
                }
                return Mono.<Void>empty();
            });
        }

        @Override
        public <T> T unmarshalFrom(final Object data,
                final TypeRef<T> typeRef) {
            return transport.unmarshalFrom(data, typeRef);
        }

        @Override
        public Mono<Void> closeGracefully() {
            return transport.closeGracefully();
        }

        @Override
        public void close() {
            transport.close();
        }

        @Override
        public List<String> protocolVersions() {
            return transport.protocolVersions();
        }
    }
}
