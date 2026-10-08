package com.extractor.mcp;

import io.modelcontextprotocol.json.TypeRef;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransport;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * 007-native-engine-runtime: the stdio transport rejects messages emitted at the same time ("Failed to enqueue
 * message"); two concurrent analyses (MAX_CONCURRENT_ANALYSES=2) must never lose a response or a notification.
 */
class SerializedTransportProviderTest {

    /** Transport that fails like the SDK stdio transport when two sends overlap. */
    static final class OverlapDetectingTransport implements McpServerTransport {
        final AtomicInteger inside = new AtomicInteger();
        final AtomicInteger sent = new AtomicInteger();

        @Override
        public Mono<Void> sendMessage(McpSchema.JSONRPCMessage message) {
            return Mono.defer(() -> {
                if (inside.incrementAndGet() > 1) {
                    inside.decrementAndGet();
                    return Mono.error(new RuntimeException("Failed to enqueue message"));
                }
                try {
                    Thread.sleep(5);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                sent.incrementAndGet();
                inside.decrementAndGet();
                return Mono.empty();
            });
        }

        @Override
        public <T> T unmarshalFrom(Object data, TypeRef<T> typeRef) {
            return null;
        }

        @Override
        public Mono<Void> closeGracefully() {
            return Mono.empty();
        }
    }

    @Test
    void concurrentSendsAreSerializedAndNeverRejected() throws Exception {
        OverlapDetectingTransport raw = new OverlapDetectingTransport();
        AtomicReference<McpServerTransport> wrapped = new AtomicReference<>();
        McpServerTransportProvider delegate = new McpServerTransportProvider() {
            @Override
            public void setSessionFactory(McpServerSession.Factory factory) {
                factory.create(raw);
            }

            @Override
            public Mono<Void> notifyClients(String method, Object params) {
                return Mono.empty();
            }

            @Override
            public Mono<Void> closeGracefully() {
                return Mono.empty();
            }
        };
        SerializedTransportProvider provider = new SerializedTransportProvider(delegate);
        provider.setSessionFactory(t -> {
            wrapped.set(t);
            return null;
        });
        McpServerTransport transport = wrapped.get();
        assertNotNull(transport);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            McpSchema.JSONRPCMessage m = new McpSchema.JSONRPCNotification("2.0", "notifications/progress", null);
            futures.add(pool.submit(() -> transport.sendMessage(m).block()));
        }
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();
        assertEquals(200, raw.sent.get());
    }
}
