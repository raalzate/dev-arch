package com.extractor.legacybdd.mcp;

import io.cucumber.java.After;
import io.cucumber.java.AfterAll;
import io.cucumber.java.Before;

/** Resets the scenario state, stops the servers a scenario started and the shared server at the end of the run. */
public class Hooks {

    @Before
    public void reset() {
        World.reset();
    }

    @After
    public void stopOwnServer() {
        if (World.ownServer != null) {
            World.ownServer.close();
        }
        World.reset();
    }

    @AfterAll
    public static void stopSharedServer() {
        Support.closeShared();
    }
}
