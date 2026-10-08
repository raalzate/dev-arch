package com.extractor.inference.config;

/**
 * Cuts of the rationale messages (text only, never the score).
 *
 * @param cohesionGood adjusted cohesion of a positive message
 * @param cohesionFair adjusted cohesion of a moderate message
 * @param couplingGood coupling below which the message is positive
 * @param couplingFair coupling below which the message is moderate
 * @param cboGood      average CBO of a positive message
 * @param cboFair      average CBO of a moderate message
 * @param lcomGood     average LCOM of a positive message
 * @param lcomFair     average LCOM of a moderate message
 * @param dataGood     data cohesion of a positive message
 * @param dataFair     data cohesion of a moderate message
 */
public record RationaleConfig(double cohesionGood, double cohesionFair,
        double couplingGood, double couplingFair, double cboGood,
        double cboFair, double lcomGood, double lcomFair, double dataGood,
        double dataFair) {
}
