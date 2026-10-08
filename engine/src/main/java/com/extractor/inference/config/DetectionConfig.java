package com.extractor.inference.config;

/**
 * Project type detection parameters.
 *
 * @param maxDepth depth of the nested marker search when the root has no
 *                 project markers (0: root only, the 1.2.0 behaviour)
 */
public record DetectionConfig(int maxDepth) {
}
