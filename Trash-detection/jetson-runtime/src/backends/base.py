"""Inference backends for Jetson runtime."""
import abc


class InferenceBackend(object):
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def run(self, blob):
        raise NotImplementedError

    @abc.abstractmethod
    def close(self):
        raise NotImplementedError
